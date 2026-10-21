// Build-time importer: never executes prototype code or touches customer data.
import fs from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
if (!process.argv[2]) throw new Error("Pass the approved handoff ZIP path.");
const zip = fs.readFileSync(process.argv[2]),
  entries = new Map();
for (let offset = 0; offset < zip.length - 46; offset++) {
  if (zip.readUInt32LE(offset) !== 0x02014b50) continue;
  const size = zip.readUInt32LE(offset + 20),
    length = zip.readUInt16LE(offset + 28),
    local = zip.readUInt32LE(offset + 42);
  const start =
      local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28),
    bytes = zip.subarray(start, start + size);
  entries.set(
    zip.subarray(offset + 46, offset + 46 + length).toString(),
    zip.readUInt16LE(offset + 10) === 8 ? inflateRawSync(bytes) : bytes,
  );
  offset +=
    45 + length + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
}
const sourceName = "approved-design/Kamelo_v5_5_Final_Web_v7.html";
const source = entries.get(sourceName).toString(),
  showcase = entries
    .get("approved-design/Kamelo_v5_5_Showcase_Rapi_v6.html")
    .toString();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (name, content) => {
  fs.mkdirSync(path.dirname(name), { recursive: true });
  fs.writeFileSync(name, content);
};
const assets = {},
  manifest = [];
for (const match of source.matchAll(
  /(im\d+):"data:image\/([^;]+);base64,([A-Za-z0-9+/=]+)"/g,
)) {
  const [, key, type, base64] = match,
    bytes = Buffer.from(base64, "base64");
  const file =
    key === "im0"
      ? "public/brand/kamelo-approved.webp"
      : `public/images/approved/${key}.${type === "jpeg" ? "jpg" : type}`;
  assets[key] = "/" + file.slice(7);
  write(file, bytes);
  manifest.push({ key, path: file, bytes: bytes.length, sha256: hash(bytes) });
}
write("lib/marketing/assets.json", JSON.stringify(assets, null, 2) + "\n");
const sections = (html) =>
  html.match(/<section\b[^>]*id="produk"[\s\S]*?<\/section>/)[0];
if (sections(source) !== sections(showcase))
  throw new Error("Showcase differs: review before importing.");
const scripts = Array.from(
  source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g),
  (m) => m[1],
);
let markup = source
  .match(/<body[^>]*>([\s\S]*?)<\/body>/)[1]
  .replace(/<script[^>]*>[\s\S]*?<\/script>/g, "");
markup = markup.replace(
  /<img\b([^>]*?)data-asset="(im\d+)"([^>]*?)>/g,
  (_, before, key, after) =>
    `<img${before}src="${assets[key]}" data-asset="${key}"${after}>`,
);
markup = markup
  .replaceAll("https://kamelo.elenio.id/login", "/login")
  .replaceAll("https://kamelo.elenio.id/register", "/register");
let planIndex = 0;
markup = markup.replace(
  /<article class="price-card[\s\S]*?<\/article>/g,
  (card) => {
    const plan = ["free", "starter", "plus"][planIndex++];
    return card
      .replace('href="/register"', `href="/register?plan=${plan}"`)
      .replace(/Rp[\d.]+(?= <span>\/bulan)/, `[[price:${plan}]]`)
      .replace(/Hingga \d+ kamar/, `Hingga [[rooms:${plan}]] kamar`)
      .replace(
        /(?:Hingga )?\d+ properti/,
        `${plan === "plus" ? "Hingga " : ""}[[properties:${plan}]] properti`,
      )
      .replace(/\d+ pengguna/, `[[users:${plan}]] pengguna`);
  },
);
// Master V3 requires explicit fixture / non-live disclosure. Original artwork is unchanged.
markup = markup.replace(
  '<div class="ks-showcase"',
  '<p class="marketing-disclosure">Eksplorasi produk dengan data contoh. Tidak mengubah data atau mengirim perintah perangkat.</p><div class="ks-showcase"',
);
markup = markup.replace(
  '<div class="cctv-values">',
  '<p class="marketing-disclosure">Contoh visual analitik · bukan kamera live.</p><div class="cctv-values">',
);
markup = markup
  .replace(
    '<a href="#fitur">Smart Room</a>',
    '<a href="#smart-room">Smart Room</a>',
  )
  .replace(
    '<section class="section" style="padding-top:16px">',
    '<section class="section" id="smart-room" style="padding-top:16px">',
  );
write(
  "lib/marketing/approved-markup.ts",
  "// Trusted build-time v7 markup: no scripts or user content.\nexport const approvedMarkup = " +
    JSON.stringify(markup) +
    ";\n",
);
const require = createRequire(import.meta.url),
  dir = fs
    .readdirSync("node_modules/.pnpm")
    .find((name) => name.startsWith("postcss@"));
const postcss = require(
  path.resolve("node_modules/.pnpm", dir, "node_modules/postcss"),
);
const css = postcss.parse(
  Array.from(
    source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g),
    (m) => m[1],
  ).join("\n"),
);
css.walkRules((rule) => {
  if (rule.parent.type === "atrule" && /keyframes/.test(rule.parent.name))
    return;
  rule.selectors = rule.selectors.map((selector) =>
    selector === ":root" || selector === "body"
      ? "#kamelo-public"
      : selector === "html"
        ? "html:has(#kamelo-public)"
        : "#kamelo-public " + selector,
  );
});
css.walkDecls("align-items", (declaration) => {
  if (declaration.value === "end") declaration.value = "flex-end";
});
write(
  "app/marketing.css",
  "/* Approved v7 CSS, isolated from the existing backoffice. */\n#kamelo-public,#kamelo-public :where(*){all:revert;box-sizing:border-box}\n#kamelo-public{display:block;font-size:16px;line-height:normal}\n" +
    css.toString() +
    '\n#kamelo-public{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Arial,sans-serif}\n#kamelo-public .marketing-disclosure{font-size:12px;color:var(--muted);margin:0 0 12px}\n',
);
let runtime = scripts[1]
  .trim()
  .replace(/^\(\(\)=>\{/, "")
  .replace(/\}\)\(\);$/, "");
if (/fetch\(|localStorage|XMLHttpRequest|eval\(/.test(runtime))
  throw new Error("Unexpected operational capability.");
runtime = runtime.replace(
  "window.addEventListener('scroll',",
  "listenToWindow('scroll',",
);
write(
  "lib/marketing/showcase-runtime.js",
  `// Approved v6/v7 isolated fixture renderer. No operational API or persistence.\nimport KAMELO_IMAGES from './assets.json';\nexport function initializeShowcase(root) {\n const initialMarkup = root.innerHTML;\n const listeners = [];\n const listenToWindow = (...args) => { window.addEventListener(...args); listeners.push(args); };\n const document = { getElementById: id => root.querySelector('#'+id), querySelector: selector => root.querySelector(selector), querySelectorAll: selector => root.querySelectorAll(selector) };\n${runtime}\n return () => { for (const args of listeners) window.removeEventListener(...args); root.innerHTML = initialMarkup; };\n}\n`,
);
write(
  "docs/APPROVED_ASSET_MANIFEST.json",
  JSON.stringify(
    {
      source: sourceName,
      sourceSha256: hash(entries.get(sourceName)),
      showcaseMarkupEqual: true,
      assets: manifest,
    },
    null,
    2,
  ) + "\n",
);
write("artifacts/handoff-v3-reference/landing-v7.html", source);
console.log(
  `Imported ${manifest.length} original assets and scoped approved v7 source.`,
);

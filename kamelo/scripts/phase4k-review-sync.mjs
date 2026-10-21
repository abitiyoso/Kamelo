// Explicit allowlist: exclude runtime uploads, credentials, database and generated output.
import { resolve, join, dirname } from "node:path";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = process.cwd(),
  destination = resolve(root, "exports/github-publish/kamelo");
const files = [
  "package.json",
  "README.md",
  "design-qa.md",
  "docs/IMPLEMENTATION_STATUS.md",
  "app/workspace.css",
  "prisma/schema.prisma",
  "prisma/migrations/20261019095000_opening_receivables/migration.sql",
  "lib/opening-balances-csv.mjs",
  "lib/opening-balances.ts",
  "lib/resident-import.ts",
  "lib/import-workbook.mjs",
  "app/api/opening-balances/route.ts",
  "app/api/import-files/route.ts",
  "components/workspace/opening-balances.tsx",
  "components/workspace/import-file.tsx",
  "components/workspace/finance.tsx",
  "public/templates/kamelo-saldo-awal.csv",
  "public/templates/kamelo-saldo-awal.xlsx",
  "tests/opening-balances.test.mjs",
  "tests/opening-balances.integration.mjs",
  "scripts/phase4k-opening-template.mjs",
  "scripts/phase4k-qa-migrate.mjs",
  "scripts/phase4k-qa-verify.mjs",
  "scripts/phase4k-review-sync.mjs",
  "docs/PHASE4K_OPENING_RECEIVABLES.md",
  "docs/PHASE4K_DESIGN_QA.md",
  ...[
    "build.log",
    "unit.log",
    "typecheck.log",
    "migration-preservation.json",
    "regression-results.json",
    "opening-balances-api.json",
    "browser-metrics.json",
    "opening-desktop-preview.png",
    "opening-desktop-saved.png",
    "opening-desktop-detail.png",
    "opening-mobile-390.png",
    "opening-mobile-320.png",
    ...[
      "integration",
      "operations.integration",
      "tenant-smart.integration",
      "acquisition.integration",
      "identity.integration",
      "workspace.integration",
      "lifecycle.integration",
      "prospects.integration",
      "subscriptions.integration",
      "finance.integration",
      "support.integration",
      "messages.integration",
      "privacy.integration",
      "room-import.integration",
      "resident-import.integration",
      "import-files.integration",
      "opening-balances.integration",
    ].map((s) => s + ".log"),
  ].map((s) => "artifacts/phase4k/" + s),
];
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  manifest = [];
for (const file of files) {
  const bytes = await readFile(join(root, file)),
    target = join(destination, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, file), target);
  if (sha(await readFile(target)) !== sha(bytes))
    throw Error("Review mismatch: " + file);
  manifest.push({ path: file, sha256: sha(bytes) });
}
const report =
  JSON.stringify(
    {
      phase: "4K opening receivables register",
      branch: "codex/phase4k-opening-receivables",
      files: manifest,
      excluded: [
        ".env*",
        ".local-secrets",
        "runtime databases",
        "node_modules",
        "generated",
        ".next",
      ],
      committed: false,
      pushed: false,
      deployed: false,
    },
    null,
    2,
  ) + "\n";
for (const target of [root, destination]) {
  await mkdir(join(target, "docs"), { recursive: true });
  await writeFile(join(target, "docs/PHASE4K_REVIEW_MANIFEST.json"), report);
}
console.log(
  `SHA-verified ${manifest.length} review files; no runtime credentials or databases copied.`,
);

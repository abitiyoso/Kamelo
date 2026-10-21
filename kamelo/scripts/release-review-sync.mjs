// Explicit review allowlist. Never copies the database dump, key or private uploads.
import { createHash } from "node:crypto";
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  readdir,
} from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
const root = process.cwd(),
  destination = resolve(root, "exports/github-publish/kamelo"),
  sha = (b) => createHash("sha256").update(b).digest("hex");
const suites = [
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
  "opening-receipts.integration",
  "opening-tenant.integration",
  "opening-reminders.integration",
  "proof-queue.integration",
  "dashboard.integration",
  "reminder.integration",
  "finance-stage4.integration",
  "integration-stage5.integration",
];
const files = [
  "package.json",
  "README.md",
  "design-qa.md",
  "docs/DATABASE.md",
  "docs/IMPLEMENTATION_STATUS.md",
  "docs/REMAINING_DELIVERY_STAGES.md",
  "docs/RELEASE_STAGE6.md",
  "docs/RELEASE_STAGE6_BROWSER_QA.md",
  "scripts/release-restore-drill.mjs",
  "scripts/release-restore-preview.mjs",
  "scripts/release-qa-verify.mjs",
  "scripts/release-review-sync.mjs",
  "tests/release-stage6.integration.mjs",
  ...[
    "restore.json",
    "regression-results.json",
    "security-load.json",
    "security-load.log",
    "unit.log",
    "typecheck.log",
    "browser.json",
    "restored-dashboard.png",
    "restored-finance.png",
    "restored-finance-390.png",
    "restored-finance-320.png",
    "restored-dashboard-restarted.png",
    "restart.json",
    ...suites.map((s) => s + ".log"),
  ].map((f) => "artifacts/release-stage6/" + f),
];
const regression = JSON.parse(
    await readFile("artifacts/release-stage6/regression-results.json", "utf8"),
  ),
  recovery = JSON.parse(
    await readFile("artifacts/release-stage6/restore.json", "utf8"),
  ),
  security = JSON.parse(
    await readFile("artifacts/release-stage6/security-load.json", "utf8"),
  );
if (
  regression.results.length !== suites.length ||
  !regression.results.every((r) => r.passed) ||
  !recovery.allPublicTableHashesPreserved ||
  !recovery.sourceUnchanged ||
  recovery.targetEncoding !== "UTF8" ||
  security.groups !== 6 ||
  security.load.errors !== 0 ||
  !security.load.financialAndOutboxHashesUnchanged
)
  throw Error("Release evidence is incomplete or failed.");
const schemaSha256 = sha(await readFile("prisma/schema.prisma"));
if (
  schemaSha256 !==
  sha(await readFile(join(destination, "prisma/schema.prisma")))
)
  throw Error("Unexpected schema change");
const migrations = [];
for (const name of await readdir("prisma/migrations")) {
  if (name === "migration_lock.toml") continue;
  const file = `prisma/migrations/${name}/migration.sql`,
    hash = sha(await readFile(file));
  if (hash !== sha(await readFile(join(destination, file))))
    throw Error("Unexpected migration change: " + name);
  migrations.push({ name, sha256: hash });
}
if (migrations.length !== 22) throw Error("Unexpected migration inventory");
await writeFile(
  "artifacts/release-stage6/data-plan.json",
  JSON.stringify(
    {
      schemaUnchanged: true,
      schemaSha256,
      migrations,
      newMigrations: 0,
      mainDatabaseTouched: false,
      productionMigrationApplied: false,
      disposableRestoreOnly: true,
    },
    null,
    2,
  ),
);
files.push("artifacts/release-stage6/data-plan.json");
// Read all allowlisted inputs before changing the review checkout.
const inputs = await Promise.all(
  files.map(async (file) => ({ file, bytes: await readFile(file) })),
);
const manifest = [];
for (const { file, bytes } of inputs) {
  if (
    /^(?:\.env|\.local|storage\/|generated\/|node_modules\/|\.next\/)/.test(
      file,
    )
  )
    throw Error("Private file in allowlist");
  const target = join(destination, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(file, target);
  const hash = sha(bytes);
  if (hash !== sha(await readFile(target)))
    throw Error("Review mismatch: " + file);
  manifest.push({ path: file, sha256: hash });
}
const report = JSON.stringify(
  {
    stage: "Stage 6 local validation verified; production acceptance pending",
    branch: "codex/release-validation",
    files: manifest,
    schemaSha256,
    migrationFilesPreserved: migrations.length,
    runtimeApplicationSourceChanged: false,
    excluded: [
      ".env*",
      ".local-secrets",
      "database dumps and clusters",
      "encryption keys",
      "fixture credentials",
      "private proof bytes",
      "mail sink",
      "node_modules",
      "generated",
      ".next",
    ],
    committed: false,
    pushed: false,
    deployed: false,
    productionAccepted: false,
  },
  null,
  2,
);
await writeFile("docs/RELEASE_STAGE6_REVIEW_MANIFEST.json", report);
await writeFile(
  join(destination, "docs/RELEASE_STAGE6_REVIEW_MANIFEST.json"),
  report,
);
console.log(
  `Verified ${manifest.length} allowlisted review files; schema and ${migrations.length} migration hashes unchanged. No commit/push/deploy.`,
);

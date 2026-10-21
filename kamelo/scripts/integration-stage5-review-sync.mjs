// Explicit reviewed files only; no environment, runtime DB, mail sink or customer uploads.
import { resolve, join, dirname } from "node:path";
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  readdir,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const root = process.cwd(),
  destination = resolve(root, "exports/github-publish/kamelo");
const files = [
  "package.json",
  "README.md",
  "design-qa.md",
  "Dockerfile",
  "docker-compose.workers.yml",
  "docs/IMPLEMENTATION_STATUS.md",
  "docs/REMAINING_DELIVERY_STAGES.md",
  "docs/INTEGRATION_SETUP.md",
  "docs/INTEGRATION_STAGE5.md",
  "docs/INTEGRATION_STAGE5_DESIGN_QA.md",
  "docs/INTEGRATION_LIVE_ACCEPTANCE.md",
  "lib/worker-client.mjs",
  "lib/integration-preflight.mjs",
  "scripts/operations-worker.mjs",
  "scripts/mail-worker.mjs",
  "scripts/reminder-worker.mjs",
  "scripts/integration-preflight.mjs",
  "scripts/integration-stage5-qa-verify.mjs",
  "scripts/integration-stage5-review-sync.mjs",
  "app/api/platform-health/route.ts",
  "components/workspace/platform-health.tsx",
  "tests/worker.test.mjs",
  "tests/worker-transport.test.mjs",
  "tests/iot-provider.test.mjs",
  "tests/integration-preflight.test.mjs",
  "tests/integration-stage5.integration.mjs",
  ...[
    "build.log",
    "unit.log",
    "typecheck.log",
    "provider-contracts.log",
    "regression-results.json",
    "preflight-offline.json",
    "preflight-api.json",
    "browser-metrics.json",
    "platform-preflight.png",
    "platform-requirements.png",
    "platform-mobile-390.png",
    "platform-mobile-320.png",
  ].map((f) => "artifacts/integration-stage5/" + f),
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
    "opening-receipts.integration",
    "opening-tenant.integration",
    "opening-reminders.integration",
    "proof-queue.integration",
    "dashboard.integration",
    "reminder.integration",
    "finance-stage4.integration",
    "integration-stage5.integration",
  ].map((f) => `artifacts/integration-stage5/${f}.log`),
];
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  manifest = [],
  migrations = [];
if (
  sha(await readFile(join(root, "prisma/schema.prisma"))) !==
  sha(await readFile(join(destination, "prisma/schema.prisma")))
)
  throw Error("Unexpected schema change");
for (const name of await readdir(join(root, "prisma/migrations"))) {
  if (name === "migration_lock.toml") continue;
  const file = `prisma/migrations/${name}/migration.sql`,
    hash = sha(await readFile(join(root, file)));
  if (hash !== sha(await readFile(join(destination, file))))
    throw Error("Unexpected migration change: " + name);
  migrations.push({ name, sha256: hash });
}
const dataPlan = JSON.stringify(
  {
    schemaUnchanged: true,
    migrationApplied: false,
    mainDatabaseTouched: false,
    schemaSha256: sha(await readFile(join(root, "prisma/schema.prisma"))),
    migrations,
  },
  null,
  2,
);
await writeFile(
  join(root, "artifacts/integration-stage5/data-plan.json"),
  dataPlan,
);
files.push("artifacts/integration-stage5/data-plan.json");
for (const file of files) {
  const bytes = await readFile(join(root, file)),
    target = join(destination, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, file), target);
  if (sha(await readFile(target)) !== sha(bytes))
    throw Error("Review mismatch: " + file);
  manifest.push({ path: file, sha256: sha(bytes) });
}
const report = JSON.stringify(
  {
    stage: "Stage 5 local readiness only; real acceptance pending",
    branch: "codex/integration-readiness",
    files: manifest,
    excluded: [
      ".env*",
      ".local-secrets",
      "runtime databases",
      "mail sink messages",
      "payment evidence",
      "node_modules",
      "generated",
      ".next",
    ],
    committed: false,
    pushed: false,
    deployed: false,
    liveAccepted: false,
  },
  null,
  2,
);
await writeFile(
  join(root, "docs/INTEGRATION_STAGE5_REVIEW_MANIFEST.json"),
  report,
);
await writeFile(
  join(destination, "docs/INTEGRATION_STAGE5_REVIEW_MANIFEST.json"),
  report,
);
console.log(
  `Verified ${manifest.length} allowlisted files; schema and ${migrations.length} migration hashes unchanged.`,
);

// Explicit review allowlist. Never copy credentials, email bodies, uploads or database files.
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
  "docs/REMAINING_DELIVERY_STAGES.md",
  "docs/REMINDER_STAGE3.md",
  "docs/REMINDER_STAGE3_DESIGN_QA.md",
  "prisma/schema.prisma",
  "prisma/migrations/20261020140000_reminder_automation/migration.sql",
  "lib/reminder-clock.mjs",
  "lib/reminder-eligibility.ts",
  "lib/reminder-automation.ts",
  "lib/opening-reminders.ts",
  "lib/email/outbox.ts",
  "lib/email/catalog.json",
  "app/api/reminder-automation/route.ts",
  "app/api/resident-reminders/route.ts",
  "app/api/jobs/reminders/route.ts",
  "components/workspace/reminder-automation.tsx",
  "components/identity/resident-reminders.tsx",
  "components/identity/resident-portal.tsx",
  "components/portal.tsx",
  "scripts/reminder-worker.mjs",
  "scripts/reminder-qa-migrate.mjs",
  "scripts/reminder-qa-verify.mjs",
  "scripts/reminder-review-sync.mjs",
  "tests/reminder.test.mjs",
  "tests/reminder.integration.mjs",
  ...[
    "build.log",
    "typecheck.log",
    "unit.log",
    "migration-preservation.json",
    "regression-results.json",
    "reminder-api.json",
    "browser-metrics.json",
    "owner-schedule.png",
    "owner-history-page2.png",
    "owner-mobile-390.png",
    "owner-mobile-320.png",
    "tenant-home.png",
    "tenant-history-page2.png",
    "tenant-mobile-390.png",
    "tenant-mobile-320.png",
  ].map((f) => "artifacts/reminder-stage3/" + f),
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
  ].map((f) => `artifacts/reminder-stage3/${f}.log`),
];
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  manifest = [];
// Existing applied migration bytes must remain identical to the review baseline.
import { readdir } from "node:fs/promises";
for (const name of await readdir(join(destination, "prisma/migrations"))) {
  if (
    name === "20261020140000_reminder_automation" ||
    name === "migration_lock.toml"
  )
    continue;
  const file = `prisma/migrations/${name}/migration.sql`;
  if (
    sha(await readFile(join(root, file))) !==
    sha(await readFile(join(destination, file)))
  )
    throw Error("Applied migration mismatch: " + name);
}
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
    stage: "Remaining stage 3 scheduled billing reminders",
    branch: "codex/reminder-automation",
    files: manifest,
    excluded: [
      ".env*",
      ".local-secrets",
      "mail sink messages",
      "runtime databases",
      "storage/payment-proofs",
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
);
await writeFile(
  join(root, "docs/REMINDER_STAGE3_REVIEW_MANIFEST.json"),
  report,
);
await writeFile(
  join(destination, "docs/REMINDER_STAGE3_REVIEW_MANIFEST.json"),
  report,
);
console.log(
  `Verified ${manifest.length} allowlisted files; previous migration bytes preserved.`,
);

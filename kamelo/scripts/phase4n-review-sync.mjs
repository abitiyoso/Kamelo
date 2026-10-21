// Allowlist only reviewed source/evidence; never copy runtime credentials or data.
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
  "prisma/schema.prisma",
  "prisma/migrations/20261020100000_opening_portal_reminders/migration.sql",
  "lib/opening-reminders.ts",
  "lib/opening-tenant.ts",
  "app/api/opening-balances/route.ts",
  "app/api/opening-tenant/route.ts",
  "components/workspace/opening-reminders.tsx",
  "components/workspace/opening-evidence.tsx",
  "components/workspace/opening-balances.tsx",
  "components/identity/opening-balances.tsx",
  "tests/opening-reminders.integration.mjs",
  "scripts/phase4n-qa-migrate.mjs",
  "scripts/phase4n-qa-verify.mjs",
  "scripts/phase4n-review-sync.mjs",
  "docs/PHASE4N_PORTAL_REMINDERS.md",
  "docs/PHASE4N_DESIGN_QA.md",
  "artifacts/phase4n/build.log",
  "artifacts/phase4n/unit.log",
  "artifacts/phase4n/typecheck.log",
  "artifacts/phase4n/migration-preservation.json",
  "artifacts/phase4n/regression-results.json",
  "artifacts/phase4n/opening-reminders-api.json",
  "artifacts/phase4n/browser-metrics.json",
  "artifacts/phase4n/owner-reminder-published.png",
  "artifacts/phase4n/owner-reminder-mobile-390.png",
  "artifacts/phase4n/tenant-reminder-desktop.png",
  "artifacts/phase4n/tenant-reminder-mobile-390.png",
  "artifacts/phase4n/tenant-reminder-mobile-320.png",
  "artifacts/phase4n/tenant-reminder-pagination.png",
  "artifacts/phase4n/opening-tenant-final.log",
  "artifacts/phase4n/opening-reminders-final.log",
  "artifacts/phase4n/integration.log",
  "artifacts/phase4n/operations.integration.log",
  "artifacts/phase4n/tenant-smart.integration.log",
  "artifacts/phase4n/acquisition.integration.log",
  "artifacts/phase4n/identity.integration.log",
  "artifacts/phase4n/workspace.integration.log",
  "artifacts/phase4n/lifecycle.integration.log",
  "artifacts/phase4n/prospects.integration.log",
  "artifacts/phase4n/subscriptions.integration.log",
  "artifacts/phase4n/finance.integration.log",
  "artifacts/phase4n/support.integration.log",
  "artifacts/phase4n/messages.integration.log",
  "artifacts/phase4n/privacy.integration.log",
  "artifacts/phase4n/room-import.integration.log",
  "artifacts/phase4n/resident-import.integration.log",
  "artifacts/phase4n/import-files.integration.log",
  "artifacts/phase4n/opening-balances.integration.log",
  "artifacts/phase4n/opening-receipts.integration.log",
  "artifacts/phase4n/opening-tenant.integration.log",
  "artifacts/phase4n/opening-reminders.integration.log",
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
      phase: "4N opening portal reminders",
      branch: "codex/phase4n-opening-portal-reminders",
      files: manifest,
      excluded: [
        ".env*",
        ".local-secrets",
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
  ) + "\n";
for (const target of [root, destination]) {
  await mkdir(join(target, "docs"), { recursive: true });
  await writeFile(join(target, "docs/PHASE4N_REVIEW_MANIFEST.json"), report);
}
console.log(
  `SHA-verified ${manifest.length} review files; no runtime credentials or databases copied.`,
);

// Explicit reviewed source/evidence allowlist; never export credentials or runtime data.
import { resolve, join, dirname } from "node:path";
import {
  readFile,
  writeFile,
  copyFile,
  mkdir,
  readdir,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const root = process.cwd(),
  destination = resolve(root, "exports/github-publish/kamelo");
const files = [
  "package.json",
  "README.md",
  "design-qa.md",
  "docs/IMPLEMENTATION_STATUS.md",
  "docs/REMAINING_DELIVERY_STAGES.md",
  "docs/FINANCE_STAGE4.md",
  "docs/FINANCE_STAGE4_DESIGN_QA.md",
  "prisma/schema.prisma",
  "prisma/migrations/20261020200000_financial_documents_refunds/migration.sql",
  "lib/opening-receipts.ts",
  "lib/finance.ts",
  "lib/finance-report.ts",
  "lib/financial-documents.ts",
  "lib/receipt-html.mjs",
  "app/api/opening-balances/route.ts",
  "app/api/financial-documents/route.ts",
  "components/workspace/financial-documents.tsx",
  "components/workspace/finance.tsx",
  "components/workspace/opening-receipts.tsx",
  "components/identity/resident-portal.tsx",
  "tests/receipt.test.mjs",
  "tests/finance-stage4.integration.mjs",
  "scripts/finance-stage4-qa-migrate.mjs",
  "scripts/finance-stage4-qa-verify.mjs",
  "scripts/finance-stage4-browser-fixture.mjs",
  "scripts/finance-stage4-review-sync.mjs",
  ...[
    "build.log",
    "unit.log",
    "typecheck.log",
    "migration-preservation.json",
    "regression-results.json",
    "finance-api.json",
    "browser-metrics.json",
    "owner-archive.png",
    "owner-archive-page2.png",
    "owner-retention-history.png",
    "owner-mobile-390.png",
    "owner-mobile-320.png",
    "tenant-archive.png",
    "tenant-archive-page2.png",
    "tenant-mobile-390.png",
    "tenant-mobile-320.png",
    "receipt-desktop.png",
    "receipt-mobile-320.png",
    "receipt-after-refund.png",
  ].map((f) => "artifacts/finance-stage4/" + f),
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
  ].map((f) => `artifacts/finance-stage4/${f}.log`),
];
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  manifest = [];
for (const name of await readdir(join(destination, "prisma/migrations"))) {
  if (
    name === "20261020200000_financial_documents_refunds" ||
    name === "migration_lock.toml"
  )
    continue;
  const path = `prisma/migrations/${name}/migration.sql`;
  if (
    sha(await readFile(join(root, path))) !==
    sha(await readFile(join(destination, path)))
  )
    throw Error("Prior migration bytes changed: " + name);
}
for (const path of files) {
  const bytes = await readFile(join(root, path)),
    target = join(destination, path);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(root, path), target);
  if (sha(await readFile(target)) !== sha(bytes))
    throw Error("Review mismatch: " + path);
  manifest.push({ path, sha256: sha(bytes) });
}
const report = JSON.stringify(
  {
    stage: "Remaining stage 4 finance completion local scope",
    branch: "codex/finance-completion",
    files: manifest,
    excluded: [
      ".env*",
      ".local-secrets",
      "mail sink",
      "runtime databases",
      "uploaded payment evidence",
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
await writeFile(join(root, "docs/FINANCE_STAGE4_REVIEW_MANIFEST.json"), report);
await writeFile(
  join(destination, "docs/FINANCE_STAGE4_REVIEW_MANIFEST.json"),
  report,
);
console.log(
  `Verified ${manifest.length} allowlisted files; previous migration bytes preserved.`,
);

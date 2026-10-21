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
  "docs/REMAINING_DELIVERY_STAGES.md",
  "docs/DASHBOARD_STAGE2.md",
  "docs/DASHBOARD_STAGE2_DESIGN_QA.md",
  "lib/finance-report.ts",
  "lib/dashboard.ts",
  "lib/dashboard-periods.mjs",
  "lib/resident-finance.ts",
  "app/api/dashboard/route.ts",
  "app/api/resident/route.ts",
  "components/owner-dashboard.tsx",
  "components/workspace/finance.tsx",
  "components/workspace/proof-queue.tsx",
  "components/portal.tsx",
  "components/identity/resident-portal.tsx",
  "tests/dashboard.test.mjs",
  "tests/dashboard.integration.mjs",
  "scripts/dashboard-qa-verify.mjs",
  "scripts/dashboard-review-sync.mjs",
  "artifacts/dashboard-stage2/build.log",
  "artifacts/dashboard-stage2/unit.log",
  "artifacts/dashboard-stage2/typecheck.log",
  "artifacts/dashboard-stage2/data-plan.json",
  "artifacts/dashboard-stage2/regression-results.json",
  "artifacts/dashboard-stage2/dashboard-api.json",
  "artifacts/dashboard-stage2/browser-metrics.json",
  "artifacts/dashboard-stage2/owner-kpis.png",
  "artifacts/dashboard-stage2/owner-debt-page2.png",
  "artifacts/dashboard-stage2/owner-cash-chart.png",
  "artifacts/dashboard-stage2/owner-empty-property.png",
  "artifacts/dashboard-stage2/owner-proof-priority.png",
  "artifacts/dashboard-stage2/owner-mobile-390.png",
  "artifacts/dashboard-stage2/owner-mobile-320.png",
  "artifacts/dashboard-stage2/tenant-home.png",
  "artifacts/dashboard-stage2/tenant-mobile-390.png",
  "artifacts/dashboard-stage2/tenant-mobile-320.png",
  "artifacts/dashboard-stage2/integration.log",
  "artifacts/dashboard-stage2/operations.integration.log",
  "artifacts/dashboard-stage2/tenant-smart.integration.log",
  "artifacts/dashboard-stage2/acquisition.integration.log",
  "artifacts/dashboard-stage2/identity.integration.log",
  "artifacts/dashboard-stage2/workspace.integration.log",
  "artifacts/dashboard-stage2/lifecycle.integration.log",
  "artifacts/dashboard-stage2/prospects.integration.log",
  "artifacts/dashboard-stage2/subscriptions.integration.log",
  "artifacts/dashboard-stage2/finance.integration.log",
  "artifacts/dashboard-stage2/support.integration.log",
  "artifacts/dashboard-stage2/messages.integration.log",
  "artifacts/dashboard-stage2/privacy.integration.log",
  "artifacts/dashboard-stage2/room-import.integration.log",
  "artifacts/dashboard-stage2/resident-import.integration.log",
  "artifacts/dashboard-stage2/import-files.integration.log",
  "artifacts/dashboard-stage2/opening-balances.integration.log",
  "artifacts/dashboard-stage2/opening-receipts.integration.log",
  "artifacts/dashboard-stage2/opening-tenant.integration.log",
  "artifacts/dashboard-stage2/opening-reminders.integration.log",
  "artifacts/dashboard-stage2/proof-queue.integration.log",
  "artifacts/dashboard-stage2/dashboard.integration.log",
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
      phase: "Remaining stage 2 dashboard and resident balances",
      branch: "codex/dashboard-insights",
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
  await writeFile(
    join(target, "docs/DASHBOARD_STAGE2_REVIEW_MANIFEST.json"),
    report,
  );
}
console.log(
  `SHA-verified ${manifest.length} review files; no runtime credentials or databases copied.`,
);

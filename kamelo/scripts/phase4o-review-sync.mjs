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
  "lib/proof-queue.ts",
  "app/api/proof-queue/route.ts",
  "components/workspace/proof-queue.tsx",
  "components/portal.tsx",
  "components/billing-tools.tsx",
  "tests/proof-queue.integration.mjs",
  "scripts/phase4o-qa-verify.mjs",
  "scripts/phase4o-review-sync.mjs",
  "docs/PHASE4O_UNIFIED_PROOF_QUEUE.md",
  "docs/PHASE4O_DESIGN_QA.md",
  "docs/REMAINING_DELIVERY_STAGES.md",
  "artifacts/phase4o/build.log",
  "artifacts/phase4o/unit.log",
  "artifacts/phase4o/typecheck.log",
  "artifacts/phase4o/data-plan.json",
  "artifacts/phase4o/regression-results.json",
  "artifacts/phase4o/proof-queue-api.json",
  "artifacts/phase4o/browser-metrics.json",
  "artifacts/phase4o/queue-invoice-approved.png",
  "artifacts/phase4o/queue-opening-approved.png",
  "artifacts/phase4o/queue-filters-desktop.png",
  "artifacts/phase4o/queue-approved-history.png",
  "artifacts/phase4o/queue-mobile-390.png",
  "artifacts/phase4o/queue-mobile-actions-390.png",
  "artifacts/phase4o/queue-mobile-320.png",
  "artifacts/phase4o/integration.log",
  "artifacts/phase4o/operations.integration.log",
  "artifacts/phase4o/tenant-smart.integration.log",
  "artifacts/phase4o/acquisition.integration.log",
  "artifacts/phase4o/identity.integration.log",
  "artifacts/phase4o/workspace.integration.log",
  "artifacts/phase4o/lifecycle.integration.log",
  "artifacts/phase4o/prospects.integration.log",
  "artifacts/phase4o/subscriptions.integration.log",
  "artifacts/phase4o/finance.integration.log",
  "artifacts/phase4o/support.integration.log",
  "artifacts/phase4o/messages.integration.log",
  "artifacts/phase4o/privacy.integration.log",
  "artifacts/phase4o/room-import.integration.log",
  "artifacts/phase4o/resident-import.integration.log",
  "artifacts/phase4o/import-files.integration.log",
  "artifacts/phase4o/opening-balances.integration.log",
  "artifacts/phase4o/opening-receipts.integration.log",
  "artifacts/phase4o/opening-tenant.integration.log",
  "artifacts/phase4o/opening-reminders.integration.log",
  "artifacts/phase4o/proof-queue.integration.log",
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
      phase: "Remaining stage 1 unified proof queue",
      branch: "codex/unified-proof-queue",
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
  await writeFile(join(target, "docs/PHASE4O_REVIEW_MANIFEST.json"), report);
}
console.log(
  `SHA-verified ${manifest.length} review files; no runtime credentials or databases copied.`,
);

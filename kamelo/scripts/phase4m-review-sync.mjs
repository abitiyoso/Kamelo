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
  "prisma/migrations/20261019140000_opening_tenant_proofs/migration.sql",
  "lib/opening-tenant.ts",
  "lib/tenant.ts",
  "lib/opening-balances.ts",
  "app/api/opening-balances/route.ts",
  "app/api/opening-tenant/route.ts",
  "app/api/opening-proofs/[id]/route.ts",
  "components/identity/opening-balances.tsx",
  "components/identity/resident-portal.tsx",
  "components/workspace/opening-evidence.tsx",
  "components/workspace/opening-receipts.tsx",
  "components/workspace/opening-balances.tsx",
  "tests/opening-tenant.integration.mjs",
  "scripts/phase4m-qa-migrate.mjs",
  "scripts/phase4m-qa-verify.mjs",
  "scripts/phase4m-review-sync.mjs",
  "docs/PHASE4M_TENANT_OPENING_PROOFS.md",
  "docs/PHASE4M_DESIGN_QA.md",
  "artifacts/phase4m/build.log",
  "artifacts/phase4m/unit.log",
  "artifacts/phase4m/typecheck.log",
  "artifacts/phase4m/migration-preservation.json",
  "artifacts/phase4m/regression-results.json",
  "artifacts/phase4m/opening-tenant-api.json",
  "artifacts/phase4m/browser-metrics.json",
  "artifacts/phase4m/tenant-proof-pending.png",
  "artifacts/phase4m/owner-proof-approved.png",
  "artifacts/phase4m/tenant-proof-approved.png",
  "artifacts/phase4m/tenant-proof-mobile-390.png",
  "artifacts/phase4m/tenant-proof-mobile-320.png",
  "artifacts/phase4m/integration.log",
  "artifacts/phase4m/operations.integration.log",
  "artifacts/phase4m/tenant-smart.integration.log",
  "artifacts/phase4m/acquisition.integration.log",
  "artifacts/phase4m/identity.integration.log",
  "artifacts/phase4m/workspace.integration.log",
  "artifacts/phase4m/lifecycle.integration.log",
  "artifacts/phase4m/prospects.integration.log",
  "artifacts/phase4m/subscriptions.integration.log",
  "artifacts/phase4m/finance.integration.log",
  "artifacts/phase4m/support.integration.log",
  "artifacts/phase4m/messages.integration.log",
  "artifacts/phase4m/privacy.integration.log",
  "artifacts/phase4m/room-import.integration.log",
  "artifacts/phase4m/resident-import.integration.log",
  "artifacts/phase4m/import-files.integration.log",
  "artifacts/phase4m/opening-balances.integration.log",
  "artifacts/phase4m/opening-receipts.integration.log",
  "artifacts/phase4m/opening-tenant.integration.log",
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
      phase: "4M tenant opening proofs",
      branch: "codex/phase4m-tenant-opening-proofs",
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
  await writeFile(join(target, "docs/PHASE4M_REVIEW_MANIFEST.json"), report);
}
console.log(
  `SHA-verified ${manifest.length} review files; no runtime credentials or databases copied.`,
);

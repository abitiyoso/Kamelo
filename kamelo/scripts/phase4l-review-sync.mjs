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
  "prisma/migrations/20261019120000_opening_receipts/migration.sql",
  "lib/opening-receipts.ts",
  "lib/opening-balances.ts",
  "lib/finance-report.ts",
  "lib/finance.ts",
  "app/api/opening-balances/route.ts",
  "app/api/finance/route.ts",
  "components/workspace/opening-receipts.tsx",
  "components/workspace/opening-balances.tsx",
  "components/workspace/finance.tsx",
  "tests/opening-receipts.integration.mjs",
  "scripts/phase4l-qa-migrate.mjs",
  "scripts/phase4l-qa-verify.mjs",
  "scripts/phase4l-review-sync.mjs",
  "docs/PHASE4L_OPENING_RECEIPTS.md",
  "docs/PHASE4L_DESIGN_QA.md",
  ...[
    "build.log",
    "unit.log",
    "typecheck.log",
    "migration-preservation.json",
    "regression-results.json",
    "opening-receipts-api.json",
    "browser-metrics.json",
    "receipt-desktop-form.png",
    "receipt-desktop-saved.png",
    "receipt-desktop-corrected.png",
    "receipt-bank-match.png",
    "receipt-mobile-390.png",
    "receipt-mobile-320.png",
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
    ].map((s) => s + ".log"),
  ].map((s) => "artifacts/phase4l/" + s),
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
      phase: "4L opening receivable collections",
      branch: "codex/phase4l-opening-receipts",
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
  await writeFile(join(target, "docs/PHASE4L_REVIEW_MANIFEST.json"), report);
}
console.log(
  `SHA-verified ${manifest.length} review files; no runtime credentials or databases copied.`,
);

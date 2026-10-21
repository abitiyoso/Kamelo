// Explicit allowlist; credentials, local databases and generated output never enter the review copy.
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
  "prisma/migrations/20261019090000_resident_imports/migration.sql",
  "lib/room-import-csv.mjs",
  "lib/resident-import-csv.mjs",
  "lib/resident-import.ts",
  "app/api/resident-imports/route.ts",
  "components/workspace/resident-import.tsx",
  "components/portal.tsx",
  "public/templates/kamelo-penghuni.csv",
  "tests/resident-import.test.mjs",
  "tests/resident-import.integration.mjs",
  "scripts/phase4i-qa-migrate.mjs",
  "scripts/phase4i-qa-verify.mjs",
  "scripts/phase4i-review-sync.mjs",
  "docs/PHASE4I_RESIDENT_IMPORTS.md",
  "docs/PHASE4I_DESIGN_QA.md",
  ...[
    "build.log",
    "unit.log",
    "typecheck.log",
    "migration-preservation.json",
    "regression-results.json",
    "resident-import-api.json",
    "browser-metrics.json",
    "resident-desktop-preview.png",
    "resident-desktop-saved.png",
    "resident-mobile-390.png",
    "resident-mobile-320.png",
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
    ].map((s) => s + ".log"),
  ].map((s) => "artifacts/phase4i/" + s),
];
const sha = (b) => createHash("sha256").update(b).digest("hex"),
  manifest = [];
for (const file of files) {
  const source = join(root, file),
    target = join(destination, file),
    bytes = await readFile(source);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  if (sha(await readFile(target)) !== sha(bytes))
    throw Error("Review mismatch: " + file);
  manifest.push({ path: file, sha256: sha(bytes) });
}
const report =
  JSON.stringify(
    {
      phase: "4I resident CSV onboarding",
      branch: "codex/phase4i-resident-imports",
      files: manifest,
      excluded: [
        ".env*",
        ".local-secrets",
        "runtime databases",
        "node_modules",
        "generated",
        ".next",
      ],
      commit: false,
      push: false,
      mainDatabaseMigration: false,
    },
    null,
    2,
  ) + "\n";
for (const base of [root, destination])
  await writeFile(join(base, "docs/PHASE4I_REVIEW_MANIFEST.json"), report);
console.log(
  `SHA-verified ${files.length} explicit source/evidence files and copied review manifest.`,
);

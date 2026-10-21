// Explicit source/evidence allowlist; never copy local uploads, credentials, databases or generated output.
import { resolve, join, dirname } from "node:path";
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const root = process.cwd(),
  destination = resolve(root, "exports/github-publish/kamelo");
const files = [
  "package.json",
  "pnpm-lock.yaml",
  "README.md",
  "design-qa.md",
  "docs/IMPLEMENTATION_STATUS.md",
  "lib/import-workbook.mjs",
  "app/api/import-files/route.ts",
  "components/workspace/import-file.tsx",
  "components/workspace/room-import.tsx",
  "components/workspace/resident-import.tsx",
  "public/templates/kamelo-kamar.xlsx",
  "public/templates/kamelo-penghuni.xlsx",
  "tests/helpers/xlsx.mjs",
  "tests/import-workbook.test.mjs",
  "tests/import-files.integration.mjs",
  "scripts/phase4j-xlsx-templates.mjs",
  "scripts/phase4j-qa-verify.mjs",
  "scripts/phase4j-review-sync.mjs",
  "docs/PHASE4J_XLSX_IMPORTS.md",
  "docs/PHASE4J_DESIGN_QA.md",
  ...[
    "build.log",
    "unit.log",
    "typecheck.log",
    "regression-results.json",
    "import-files-api.json",
    "browser-metrics.json",
    "templates-http.json",
    "xlsx-desktop-mapping.png",
    "xlsx-desktop-preview.png",
    "xlsx-desktop-saved.png",
    "xlsx-mobile-390.png",
    "xlsx-mobile-320.png",
    "xlsx-resident-mobile-390.png",
    "xlsx-resident-preview.png",
    "xlsx-resident-saved.png",
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
    ].map((s) => s + ".log"),
  ].map((s) => "artifacts/phase4j/" + s),
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
      phase: "4J XLSX room/resident onboarding",
      branch: "codex/phase4j-xlsx-imports",
      files: manifest,
      excluded: [
        ".env*",
        ".local-secrets",
        "runtime databases",
        "node_modules",
        "generated",
        ".next",
      ],
      schemaMigration: false,
      commit: false,
      push: false,
      mainDatabaseMigration: false,
    },
    null,
    2,
  ) + "\n";
for (const base of [root, destination])
  await writeFile(join(base, "docs/PHASE4J_REVIEW_MANIFEST.json"), report);
console.log(
  `SHA-verified ${files.length} explicit source/evidence files and copied review manifest.`,
);

// Explicit source/evidence allowlist. Never copy credentials, runtime databases or generated output.
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
  "prisma/migrations/20261019080000_room_imports/migration.sql",
  "lib/room-import-csv.mjs",
  "lib/room-import.ts",
  "app/api/room-imports/route.ts",
  "components/workspace/room-import.tsx",
  "components/portal.tsx",
  "app/workspace.css",
  "public/templates/kamelo-kamar.csv",
  "tests/room-import.test.mjs",
  "tests/room-import.integration.mjs",
  "scripts/phase4h-qa-migrate.mjs",
  "scripts/phase4h-qa-verify.mjs",
  "scripts/phase4h-review-sync.mjs",
  "docs/PHASE4H_ROOM_IMPORTS.md",
  "docs/PHASE4H_DESIGN_QA.md",
  ...[
    "build.log",
    "unit.log",
    "typecheck.log",
    "migration-preservation.json",
    "regression-results.json",
    "room-import-api.json",
    "room-import-final.log",
    "import-desktop-preview.png",
    "import-desktop-saved.png",
    "import-mobile-390.png",
    "import-mobile-320.png",
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
    ].map((s) => s + ".log"),
  ].map((s) => "artifacts/phase4h/" + s),
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
    throw Error("Review copy mismatch: " + file);
  manifest.push({ path: file, sha256: sha(bytes) });
}
const report =
  JSON.stringify(
    {
      phase: "4H room-only CSV onboarding",
      branch: "codex/phase4h-room-imports",
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
  await writeFile(join(base, "docs/PHASE4H_REVIEW_MANIFEST.json"), report);
console.log(
  `SHA-verified ${files.length} explicit source/evidence files and copied review manifest.`,
);

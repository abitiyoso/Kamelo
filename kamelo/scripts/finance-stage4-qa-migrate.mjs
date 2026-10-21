import { PrismaClient } from "../generated/prisma/index.js";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const url =
    "postgresql://kamelo_phase2_qa:kamelo_disposable_qa@127.0.0.1:55432/kamelo_phase2_qa",
  db = new PrismaClient({ datasources: { db: { url } } });
try {
  const columns =
    await db.$queryRaw`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name NOT IN ('_prisma_migrations','FinancialDocument','FinancialDocumentReview') ORDER BY table_name,ordinal_position`;
  const tables = new Map();
  for (const c of columns) {
    if (!tables.has(c.table_name)) tables.set(c.table_name, []);
    tables.get(c.table_name).push(c.column_name);
  }
  const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
  const snapshot = async () => {
    const result = {};
    for (const [name, cols] of tables) {
      const rows = await db.$queryRawUnsafe(
        `SELECT to_jsonb(t)::text AS row FROM (SELECT ${cols.map(quote).join(",")} FROM ${quote(name)}) t ORDER BY to_jsonb(t)::text`,
      );
      result[name] = {
        columns: cols,
        count: rows.length,
        sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
      };
    }
    return result;
  };
  const before = await snapshot();
  await db.$disconnect();
  const run = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
  );
  if (run.status !== 0) throw Error("QA migration failed");
  const after = await snapshot();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error("Existing values changed");
  await mkdir("artifacts/finance-stage4", { recursive: true });
  await writeFile(
    "artifacts/finance-stage4/migration-preservation.json",
    JSON.stringify(
      {
        scope: "Disposable QA only; all original columns compared",
        before,
        after,
      },
      null,
      2,
    ),
  );
  console.log(`PASS all original values in ${tables.size} pre-existing tables`);
} finally {
  await db.$disconnect();
}

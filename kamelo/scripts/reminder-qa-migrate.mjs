import { PrismaClient } from "../generated/prisma/index.js";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const url =
  "postgresql://kamelo_phase2_qa:kamelo_disposable_qa@127.0.0.1:55432/kamelo_phase2_qa";
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const tables =
    await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','ReminderPolicy','ReminderDelivery') ORDER BY tablename`;
  const snapshot = async () => {
    const values = {};
    for (const { tablename } of tables) {
      const rows = await db.$queryRawUnsafe(
        `SELECT to_jsonb(t)::text AS row FROM "${tablename.replaceAll('"', '""')}" t ORDER BY to_jsonb(t)::text`,
      );
      values[tablename] = {
        count: rows.length,
        sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
      };
    }
    return values;
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
    throw Error("Pre-existing rows changed");
  await mkdir("artifacts/reminder-stage3", { recursive: true });
  await writeFile(
    "artifacts/reminder-stage3/migration-preservation.json",
    JSON.stringify(
      {
        scope: "Disposable QA only; production migration remains pending",
        before,
        after,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS preservation of all ${tables.length} pre-existing public tables`,
  );
} finally {
  await db.$disconnect();
}

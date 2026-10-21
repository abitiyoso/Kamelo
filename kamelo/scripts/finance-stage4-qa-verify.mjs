import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
const db = new URL(process.env.DATABASE_URL || "http://invalid");
if (
  db.hostname !== "127.0.0.1" ||
  db.port !== "55432" ||
  db.pathname !== "/kamelo_phase2_qa" ||
  process.env.TEST_URL !== "http://127.0.0.1:3001"
)
  throw Error("Isolated QA environment required.");
await mkdir("artifacts/finance-stage4", { recursive: true });
const results = [];
for (const script of [
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
]) {
  try {
    const { stdout, stderr } = await promisify(execFile)(
      process.execPath,
      [`tests/${script}.mjs`],
      { env: process.env, maxBuffer: 4 * 1024 * 1024 },
    );
    await writeFile(`artifacts/finance-stage4/${script}.log`, stdout + stderr);
    results.push({ script, passed: true });
    console.log("PASS", script);
  } catch (e) {
    await writeFile(
      `artifacts/finance-stage4/${script}.log`,
      (e.stdout || "") + (e.stderr || ""),
    );
    results.push({ script, passed: false });
    console.error("FAIL", script);
    process.exitCode = 1;
  }
}
await writeFile(
  "artifacts/finance-stage4/regression-results.json",
  JSON.stringify(
    {
      completedAt: new Date().toISOString(),
      externalEmail: false,
      environment: "disposable QA 55432 / loopback 3001",
      results,
    },
    null,
    2,
  ),
);

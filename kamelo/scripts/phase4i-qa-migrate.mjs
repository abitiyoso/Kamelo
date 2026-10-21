// Apply only to the existing disposable QA instance; never infer a production URL.
import { PrismaClient } from "../generated/prisma/index.js";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const url =
  "postgresql://kamelo_phase2_qa:kamelo_disposable_qa@127.0.0.1:55432/kamelo_phase2_qa";
const db = new PrismaClient({ datasources: { db: { url } } });
const snapshot = async () => {
  const result = {};
  for (const table of [
    "RoomImportBatch",
    "PrivacyRequest",
    "PrivacyEntry",
    "MessageThread",
    "MessageEntry",
    "SupportCase",
    "SupportEntry",
    "Expense",
    "ExpenseEntry",
    "FinanceMatch",
    "Invoice",
    "Payment",
    "Stay",
    "Room",
    "Guest",
    "Prospect",
    "ProspectActivity",
    "Upgrade",
    "SaaSBillingProfile",
    "SubscriptionInvoice",
    "SubscriptionEntry",
    "SubscriptionEvent",
    "ResidentProfile",
    "Contract",
    "ContractVersion",
    "DepositAccount",
    "DepositEntry",
    "DepositAdjustment",
    "RoomTransfer",
    "LifecycleCommand",
    "Organization",
    "User",
    "Session",
    "OrgMembership",
    "OccupantAccess",
  ]) {
    const rows = await db.$queryRawUnsafe(
      `SELECT * FROM "${table}" ORDER BY "${table === "Session" ? "token" : table === "SaaSBillingProfile" ? "organizationId" : "id"}"`,
    );
    result[table] = {
      count: rows.length,
      hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }
  return result;
};
try {
  const before = await snapshot();
  await db.$disconnect();
  const run = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
  );
  if (run.status !== 0) process.exit(run.status || 1);
  const after = await snapshot();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw Error("Existing business rows changed unexpectedly");
  await mkdir("artifacts/phase4i", { recursive: true });
  await writeFile(
    "artifacts/phase4i/migration-preservation.json",
    JSON.stringify({ before, after }, null, 2),
  );
  console.log(
    "QA migration applied; all existing invoice/payment/stay/room/guest/organization row hashes preserved.",
  );
} finally {
  await db.$disconnect();
}

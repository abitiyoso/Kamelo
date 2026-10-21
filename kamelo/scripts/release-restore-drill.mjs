// Disposable, loopback-only recovery rehearsal. Never targets the main database.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash, createDecipheriv, randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  copyFile,
  readdir,
  stat,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { PrismaClient } from "../generated/prisma/index.js";
import { stableHash } from "../lib/lifecycle-rules.mjs";

const sourceUrl = new URL(process.env.DATABASE_URL || "http://invalid");
assert.equal(sourceUrl.hostname, "127.0.0.1");
assert.equal(sourceUrl.port, "55432");
assert.equal(sourceUrl.pathname, "/kamelo_phase2_qa");
assert.equal(
  process.platform,
  "win32",
  "This rehearsal launcher uses the bundled Windows PostgreSQL runtime.",
);
const privateRoot = resolve(".local-secrets/release-stage6"),
  run = join(privateRoot, "drill-" + Date.now()),
  data = join(run, "postgres"),
  native = resolve(
    "node_modules/.pnpm/@embedded-postgres+windows-x64@18.4.0-beta.17/node_modules/@embedded-postgres/windows-x64/native/bin",
  ),
  tools = resolve(
    process.env.PGTOOLS_BIN || join(privateRoot, "tools/pgsql/bin"),
  ),
  artifacts = resolve("artifacts/release-stage6"),
  started = performance.now(),
  sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
await mkdir(run, { recursive: true });
await mkdir(artifacts, { recursive: true });
const execute = async (file, args, env = process.env) => {
  try {
    return await promisify(execFile)(file, args, {
      env,
      windowsHide: true,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 240000,
    });
  } catch (e) {
    await writeFile(
      join(run, "failure.log"),
      String(e.stdout || "") + String(e.stderr || ""),
    );
    throw Error(
      "Recovery command failed; inspect the private drill failure.log.",
    );
  }
};
// Refuse an occupied destination port; never stop another server or reuse its data.
await new Promise((done, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(55433, "127.0.0.1", () => probe.close(done));
});
const password = randomBytes(32).toString("hex"),
  role = "kamelo_restore_qa",
  targetUrl = `postgresql://${role}:${password}@127.0.0.1:55433/kamelo_release_restore`,
  pwfile = join(run, "postgres-password.txt"),
  key = (await readFile(".local-secrets/phase2-qa-key.txt", "utf8")).trim();
assert.match(key, /^[a-f0-9]{64}$/i);
await writeFile(pwfile, password, { flag: "wx", mode: 0o600 });
await execute(join(native, "initdb.exe"), [
  "-D",
  data,
  "--encoding=UTF8",
  "--locale=C",
  "--auth=scram-sha-256",
  "--username=" + role,
  "--pwfile=" + pwfile,
]);
// On Windows postgres can inherit pg_ctl's pipes; wait for process exit, not pipe EOF.
await new Promise((done, reject) => {
  const child = spawn(
    join(native, "pg_ctl.exe"),
    [
      "-D",
      data,
      "-l",
      join(run, "postgres.log"),
      "-o",
      "-p 55433 -h 127.0.0.1",
      "-w",
      "start",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  child.once("error", reject);
  child.once("exit", (code) =>
    code === 0
      ? done()
      : reject(
          Error(
            "Recovery server start failed; inspect its private postgres.log.",
          ),
        ),
  );
});
await writeFile(join(run, "key.txt"), key, { flag: "wx", mode: 0o600 });
await mkdir(join(run, "fixtures"));
for (const name of [
  "finance-stage4-browser.json",
  "phase4m-browser.json",
  "integration-stage5-browser.json",
])
  await copyFile(join(".local-secrets", name), join(run, "fixtures", name));
const config = {
  databaseUrl: targetUrl,
  keyFile: join(run, "key.txt"),
  proofDirectory: join(run, "proofs"),
  data,
  native,
  run,
};
await writeFile(join(privateRoot, "current.json"), JSON.stringify(config), {
  mode: 0o600,
});
const source = new PrismaClient({ datasourceUrl: sourceUrl.href }),
  admin = new PrismaClient({
    datasourceUrl: targetUrl.replace("/kamelo_release_restore", "/postgres"),
  });
let restored;
const digestTables = async (client) => {
  const tables =
    await client.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  const result = {};
  for (const { tablename } of tables) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    const rows = await client.$queryRawUnsafe(
      `SELECT to_jsonb(t)::text AS row FROM public.${quoted} t`,
    );
    result[tablename] = {
      count: rows.length,
      sha256: sha(JSON.stringify(rows.map((x) => x.row).sort())),
    };
  }
  return result;
};
const schemaDigest = async (client) => {
  const queries = [
    `SELECT c.relname, con.conname, pg_get_constraintdef(con.oid,true) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'`,
    `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'`,
    `SELECT c.relname, pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal`,
    `SELECT p.proname, pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'`,
  ];
  return Promise.all(
    queries.map(async (q) =>
      sha(
        JSON.stringify(
          (await client.$queryRawUnsafe(q))
            .map((x) => JSON.stringify(x))
            .sort(),
        ),
      ),
    ),
  );
};
try {
  await admin.$executeRawUnsafe(
    `CREATE DATABASE kamelo_release_restore TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C'`,
  );
  restored = new PrismaClient({ datasourceUrl: targetUrl });
  const dump = join(run, "database.dump"),
    dumpStart = performance.now();
  // One exported repeatable-read snapshot covers both the dump and row hashes.
  const before = await source.$transaction(
    async (tx) => {
      const [{ snapshot }] =
        await tx.$queryRaw`SELECT pg_export_snapshot() AS snapshot`;
      const tables = await digestTables(tx),
        schema = await schemaDigest(tx);
      await execute(
        join(tools, "pg_dump.exe"),
        [
          "--host=127.0.0.1",
          "--port=55432",
          "--username=" + decodeURIComponent(sourceUrl.username),
          "--dbname=kamelo_phase2_qa",
          "--format=custom",
          "--encoding=UTF8",
          "--snapshot=" + snapshot,
          "--file=" + dump,
          "--no-password",
        ],
        { ...process.env, PGPASSWORD: decodeURIComponent(sourceUrl.password) },
      );
      return { tables, schema };
    },
    { isolationLevel: "RepeatableRead", timeout: 240000 },
  );
  const dumpMs = Math.round(performance.now() - dumpStart),
    restoreStart = performance.now();
  await execute(
    join(tools, "pg_restore.exe"),
    [
      "--host=127.0.0.1",
      "--port=55433",
      "--username=" + role,
      "--dbname=kamelo_release_restore",
      "--no-owner",
      "--no-acl",
      "--single-transaction",
      "--exit-on-error",
      "--no-password",
      dump,
    ],
    { ...process.env, PGPASSWORD: password },
  );
  const restoreMs = Math.round(performance.now() - restoreStart),
    after = {
      tables: await digestTables(restored),
      schema: await schemaDigest(restored),
    };
  assert.deepEqual(
    after,
    before,
    "All public table values and constraints/indexes/triggers/functions must survive recovery.",
  );
  assert.deepEqual(
    await digestTables(source),
    before.tables,
    "Rehearsal must not mutate its source QA database.",
  );
  const [{ encoding: sourceEncoding }] =
    await source.$queryRaw`SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname=current_database()`;
  const [{ encoding: targetEncoding }] =
    await restored.$queryRaw`SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname=current_database()`;
  assert.equal(targetEncoding, "UTF8");
  // Store non-Latin text in an existing app field on the restored copy only.
  const unicode = "Kamelo • hunian nyaman — 日本語 العربية 🏡";
  await restored.$transaction(async (tx) => {
    const sample = await tx.organization.findFirstOrThrow();
    await tx.organization.update({
      where: { id: sample.id },
      data: { name: unicode },
    });
    assert.equal(
      (await tx.organization.findUniqueOrThrow({ where: { id: sample.id } }))
        .name,
      unicode,
    );
    await tx.organization.update({
      where: { id: sample.id },
      data: { name: sample.name },
    });
  });
  assert.deepEqual(await digestTables(restored), before.tables);
  // Copy bytes separately: a SQL dump cannot recover private uploaded evidence.
  const proofSource = resolve("storage/payment-proofs"),
    proofTarget = config.proofDirectory;
  await mkdir(proofTarget, { recursive: true });
  let copiedFiles = 0;
  async function copyTree(from, to) {
    for (const entry of await readdir(from, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), "Private backup refuses symlinks");
      const a = join(from, entry.name),
        b = join(to, entry.name);
      if (entry.isDirectory()) {
        await mkdir(b, { recursive: true });
        await copyTree(a, b);
      } else {
        await copyFile(a, b);
        assert.equal(sha(await readFile(a)), sha(await readFile(b)));
        copiedFiles++;
      }
    }
  }
  await copyTree(proofSource, proofTarget);
  const proofRows = await restored.$queryRawUnsafe(
    `SELECT "storageKey", "contentHash", "fileSize", reference, NULL::text AS "requestHash" FROM "PaymentProof" UNION ALL SELECT "storageKey", "contentHash", "fileSize", reference, "requestHash" FROM "OpeningProof"`,
  );
  let verifiedProofs = 0,
    syntheticPlaceholders = 0,
    syntheticCopiedHistory = 0;
  for (const row of proofRows) {
    assert.match(row.storageKey, /^[a-zA-Z0-9._-]+$/);
    // Earlier pagination/suppression suites deliberately inserted metadata-only UUID hashes.
    // This narrow exception is for this named disposable QA database, never a production backup policy.
    if (
      /^(QUEUE-HISTORY-|REMINDER-PENDING$)/.test(row.reference) &&
      /^[a-f0-9-]{36}$/.test(row.contentHash)
    ) {
      for (const folder of [proofSource, proofTarget]) {
        await assert.rejects(readFile(join(folder, row.storageKey)), {
          code: "ENOENT",
        });
      }
      syntheticPlaceholders++;
    } else if (
      /^HISTORY-\d+$/.test(row.reference) &&
      row.requestHash === sha("history" + row.reference.slice(8)) &&
      row.contentHash === sha("history-content" + row.reference.slice(8))
    ) {
      // The old opening-tenant pagination fixture copied a file but intentionally used a synthetic content hash.
      const bytes = await readFile(join(proofTarget, row.storageKey));
      assert.equal(
        sha(bytes),
        sha(await readFile(join(proofSource, row.storageKey))),
      );
      assert.equal(bytes.length, row.fileSize);
      syntheticCopiedHistory++;
    } else {
      const bytes = await readFile(join(proofTarget, row.storageKey));
      assert.equal(sha(bytes), row.contentHash);
      assert.equal(bytes.length, row.fileSize);
      verifiedProofs++;
    }
  }
  let decryptedDocuments = 0;
  for (const doc of await restored.financialDocument.findMany()) {
    const [v, iv, tag, payload] = doc.encryptedSnapshot.split(".");
    assert.equal(v, "v1");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAAD(Buffer.from("kamelo:smart-access:v1"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(payload, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    assert.equal(stableHash(JSON.parse(plain)), doc.snapshotHash);
    decryptedDocuments++;
  }
  const version = (
    await execute(join(tools, "pg_dump.exe"), ["--version"])
  ).stdout.trim();
  await writeFile(
    join(artifacts, "restore.json"),
    JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        scope: "Disposable QA only; no main database or production changes",
        sourceEncoding,
        targetEncoding,
        toolVersion: version,
        dumpMs,
        restoreMs,
        elapsedMs: Math.round(performance.now() - started),
        dumpBytes: (await stat(dump)).size,
        dumpSha256: sha(await readFile(dump)),
        exportedSnapshot: true,
        allPublicTableHashesPreserved: true,
        sourceUnchanged: true,
        constraintsIndexesTriggersFunctionsPreserved: true,
        unicodeRoundTrip: true,
        tables: before.tables,
        copiedPrivateFiles: copiedFiles,
        referencedProofFilesVerified: verifiedProofs,
        metadataOnlySyntheticProofFixtures: syntheticPlaceholders,
        copiedHistoryFixturesWithSyntheticHashes: syntheticCopiedHistory,
        newMissingEvidenceAfterRestore: 0,
        syntheticFixtureException:
          "Only named metadata-only UUID fixtures and old HISTORY-n rows matching both exact history/history-content fixture hash formulas. Every available file is byte-identical to source. These exceptions must never be used for production evidence acceptance.",
        financialDocumentSnapshotsDecryptedAndHashVerified: decryptedDocuments,
        privateBackupExcludedFromExport: true,
        liveProvidersEnabled: false,
        productionRpoRto:
          "Not established: this is a local synthetic-data rehearsal, not a scheduled production backup or production recovery time guarantee.",
        roleAclRestore:
          "Deliberately remapped to disposable owner; production roles/ACLs require separate acceptance.",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS UTF-8 recovery: table/schema hashes, Unicode, evidence and encrypted documents verified.",
  );
} finally {
  await source.$disconnect();
  await admin.$disconnect();
  await restored?.$disconnect();
}

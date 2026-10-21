// Recovery-copy preview only; no .env loading and no live provider credentials.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const c = JSON.parse(
    await readFile(".local-secrets/release-stage6/current.json", "utf8"),
  ),
  u = new URL(c.databaseUrl);
assert.equal(u.hostname, "127.0.0.1");
assert.equal(u.port, "55433");
assert.equal(u.pathname, "/kamelo_release_restore");
const key = (await readFile(c.keyFile, "utf8")).trim();
// Deliberately construct a minimal environment rather than inherit provider secrets.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) =>
    /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS|PROCESSOR_ARCHITECTURE)$/i.test(
      k,
    ),
  ),
);
Object.assign(env, {
  NODE_ENV: "production",
  DATABASE_URL: c.databaseUrl,
  APP_URL: "http://127.0.0.1:3002",
  MAIL_DRIVER: "disabled",
  MAIL_LIVE_ENABLED: "false",
  MAIL_TEST_RECIPIENTS: "",
  SMTP_USERNAME: "",
  SMTP_PASSWORD: "",
  MAIL_ENDPOINT: "",
  MAIL_API_KEY: "",
  DATA_ENCRYPTION_KEY: key,
  OPERATIONS_JOB_KEY: key,
  PROOF_STORAGE_DIR: c.proofDirectory,
});
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3002",
  ],
  { env, stdio: "inherit", windowsHide: true },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));

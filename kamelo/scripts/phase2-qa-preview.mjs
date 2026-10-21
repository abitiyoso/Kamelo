// Local production preview against the disposable QA database only.
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
await mkdir(".local-secrets", { recursive: true });
const keyFile = ".local-secrets/phase2-qa-key.txt";
try {
  await writeFile(keyFile, randomBytes(32).toString("hex"), {
    flag: "wx",
    mode: 0o600,
  });
} catch (e) {
  if (e.code !== "EEXIST") throw e;
}
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3001",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL:
        "postgresql://kamelo_phase2_qa:kamelo_disposable_qa@127.0.0.1:55432/kamelo_phase2_qa",
      APP_URL: "http://127.0.0.1:3001",
      MAIL_DRIVER: "sink",
      MAIL_LIVE_ENABLED: "false",
      OPERATIONS_JOB_KEY: (await readFile(keyFile, "utf8")).trim(),
      DATA_ENCRYPTION_KEY: (await readFile(keyFile, "utf8")).trim(),
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 0));

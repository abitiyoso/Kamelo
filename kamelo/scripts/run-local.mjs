import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
// Convenience runner for this repository's local-only PostgreSQL and Next server.
const children = [];
const start = (args, env = process.env) => {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  children.push(child);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  return child;
};
const database = start(["scripts/local-db.mjs"]);
let stopping = false;
async function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  const alive = children.filter(
    (child) => child.exitCode === null && child.signalCode === null,
  );
  const exited = Promise.all(
    alive.map((child) => new Promise((resolve) => child.once("exit", resolve))),
  );
  for (const child of alive) {
    if (child === database && child.connected) child.send("stop");
    else child.kill("SIGTERM");
  }
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  process.exit(code);
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void stopAll());
process.on("uncaughtException", (error) => {
  console.error(error.message);
  void stopAll(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  void stopAll(1);
});
await new Promise((resolve, reject) => {
  database.stdout.on("data", (chunk) => {
    if (chunk.toString().includes("PostgreSQL ready")) resolve();
  });
  database.once("exit", (code) =>
    reject(new Error("Local database exited: " + code)),
  );
});
const env = {
  ...process.env,
  OPERATIONS_JOB_KEY:
    process.env.OPERATIONS_JOB_KEY || randomBytes(32).toString("hex"),
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://koshotel:koshotel_local@127.0.0.1:5432/koshotel",
  APP_URL: process.env.APP_URL ?? "http://127.0.0.1:3000",
};
const command = (args) =>
  new Promise((resolve, reject) => {
    const c = start(args, env);
    c.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Setup failed: " + code)),
    );
  });
await command(["node_modules/prisma/build/index.js", "generate"]);
await command(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
const app = start(
  [
    "node_modules/next/dist/bin/next",
    process.argv.includes("--production") ? "start" : "dev",
    "--hostname",
    "127.0.0.1",
  ],
  env,
);
start(["scripts/operations-worker.mjs"], env);
app.once("exit", (code) => {
  if (!stopping) void stopAll(code ?? 1);
});

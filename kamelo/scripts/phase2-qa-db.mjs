import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const pg = new EmbeddedPostgres({
  databaseDir: ".local-db-phase2-qa",
  user: "kamelo_phase2_qa",
  password: "kamelo_disposable_qa",
  port: 55432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(".local-db-phase2-qa/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const found = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = 'kamelo_phase2_qa'",
);
await client.end();
if (!found.rowCount) await pg.createDatabase("kamelo_phase2_qa");
console.log("PostgreSQL ready at 127.0.0.1:55432; isolated Phase 2 QA only.");
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);
process.on("message", (message) => {
  if (message === "stop") void stop();
});
setInterval(() => {}, 60000);

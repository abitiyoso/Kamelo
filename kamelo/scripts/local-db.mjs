import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const pg = new EmbeddedPostgres({
  databaseDir: ".local-db",
  user: "koshotel",
  password: "koshotel_local",
  port: 5432,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
if (!existsSync(".local-db/PG_VERSION")) await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
const found = await client.query(
  "SELECT 1 FROM pg_database WHERE datname = 'koshotel'",
);
await client.end();
if (!found.rowCount) await pg.createDatabase("koshotel");
console.log("PostgreSQL ready at 127.0.0.1:5432; local development only.");
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

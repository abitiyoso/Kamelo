// Read-only: no .env loading, provider connection, DB query, email or device command.
import { integrationPreflight } from "../lib/integration-preflight.mjs";
const report = integrationPreflight();
console.log(JSON.stringify(report, null, 2));
// A generated configuration report is not permission to release an unverified integration.
if (
  process.argv.includes("--require-live") &&
  report.liveAcceptance !== "VERIFIED"
)
  process.exitCode = 2;

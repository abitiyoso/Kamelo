// Same server key; no customer data or secrets are logged.
import {
  workerConfiguration,
  requestJob,
  startWorker,
} from "../lib/worker-client.mjs";
const config = workerConfiguration(process.env, "http://127.0.0.1:3000");
startWorker((signal) => requestJob(config, "/api/jobs", { signal }), {
  intervalMs: 60000,
  label: "Operations worker",
});

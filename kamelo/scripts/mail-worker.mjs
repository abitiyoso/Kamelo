// Explicitly started; delivery remains subject to transport live/recipient gates.
import {
  workerConfiguration,
  requestJob,
  startWorker,
} from "../lib/worker-client.mjs";
const config = workerConfiguration();
startWorker((signal) => requestJob(config, "/api/jobs/mail", { signal }), {
  intervalMs: 30000,
  label: "Mail worker",
});

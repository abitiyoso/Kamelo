// Scheduler only; run the separately gated mail worker to dispatch email.
import {
  workerConfiguration,
  drainReminderPages,
  startWorker,
} from "../lib/worker-client.mjs";
const config = workerConfiguration(process.env, "http://127.0.0.1:3000");
startWorker((signal) => drainReminderPages(config, { signal }), {
  intervalMs: 60000,
  label: "Reminder worker",
});

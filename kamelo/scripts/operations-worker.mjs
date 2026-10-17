// Same key as the server. No customer data or secrets are logged.
const base = process.env.APP_URL || "http://127.0.0.1:3000",
  key = process.env.OPERATIONS_JOB_KEY;
if (!key || key.length < 64)
  throw new Error(
    "Set OPERATIONS_JOB_KEY (at least 64 characters) for both server and worker.",
  );
let stopping = false,
  timer;
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    stopping = true;
    clearTimeout(timer);
    controller.abort();
  });
async function tick() {
  try {
    const r = await fetch(base + "/api/jobs", {
      method: "POST",
      headers: { Authorization: "Bearer " + key },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
    });
    if (!r.ok) console.error("Operations job failed:", r.status);
    else console.log("Operations job completed.");
  } catch (e) {
    if (!stopping) console.error("Operations job waiting for server:", e.name);
  }
  if (!stopping) timer = setTimeout(tick, 60000);
}
await tick();

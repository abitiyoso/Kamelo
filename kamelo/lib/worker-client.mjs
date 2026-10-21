const routes = new Set(["/api/jobs", "/api/jobs/mail", "/api/jobs/reminders"]);
export function workerOrigin(value) {
  let origin;
  try {
    origin = new URL(value);
  } catch {
    throw Error("WORKER_ORIGIN_INVALID");
  }
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/" ||
    !(
      origin.protocol === "https:" ||
      (origin.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
    )
  )
    throw Error("WORKER_ORIGIN_INVALID");
  return origin.origin;
}
export function workerConfiguration(env = process.env, fallback = "") {
  const origin = workerOrigin(env.APP_URL || fallback);
  const key = env.OPERATIONS_JOB_KEY || "";
  if (key.length < 64 || key.length > 4096 || /\s/.test(key))
    throw Error("WORKER_KEY_INVALID");
  return { origin, key };
}
// Only fixed same-origin job paths may carry the server secret. Never follow redirects.
export async function requestJob(
  config,
  route,
  { cursor = "", signal, fetcher = fetch } = {},
) {
  config = workerConfiguration({
    APP_URL: config.origin,
    OPERATIONS_JOB_KEY: config.key,
  });
  if (!routes.has(route)) throw Error("WORKER_ROUTE_INVALID");
  if (
    cursor &&
    (route !== "/api/jobs/reminders" ||
      typeof cursor !== "string" ||
      cursor.length > 100)
  )
    throw Error("WORKER_CURSOR_INVALID");
  const url = new URL(route, config.origin);
  if (cursor) url.searchParams.set("after", cursor);
  try {
    const r = await fetcher(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + config.key },
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(55000)])
        : AbortSignal.timeout(55000),
    });
    if (!r.ok) throw Error("WORKER_HTTP_ERROR");
    const text = await r.text();
    if (text.length > 16384) throw Error("WORKER_RESPONSE_INVALID");
    const d = JSON.parse(text),
      count = (n) => Number.isSafeInteger(n) && n >= 0;
    if (
      !d ||
      typeof d !== "object" ||
      (route === "/api/jobs" && (d.ok !== true || !count(d.issued))) ||
      (route === "/api/jobs/mail" && !count(d.processed)) ||
      (route === "/api/jobs/reminders" &&
        (d.ok !== true ||
          !count(d.portal) ||
          !count(d.email) ||
          !(
            d.next === null ||
            (typeof d.next === "string" &&
              d.next.length > 0 &&
              d.next.length <= 100)
          )))
    )
      throw Error("WORKER_RESPONSE_INVALID");
    return route === "/api/jobs"
      ? { issued: d.issued }
      : route === "/api/jobs/mail"
        ? { processed: d.processed }
        : { portal: d.portal, email: d.email, next: d.next };
  } catch {
    throw Error(signal?.aborted ? "WORKER_STOPPED" : "WORKER_REQUEST_FAILED");
  }
}
export async function drainReminderPages(
  config,
  { signal, fetcher = fetch } = {},
) {
  let cursor = "",
    pages = 0,
    portal = 0,
    email = 0;
  const visited = new Set();
  do {
    if (signal?.aborted) throw Error("WORKER_STOPPED");
    const d = await requestJob(config, "/api/jobs/reminders", {
      cursor,
      signal,
      fetcher,
    });
    pages++;
    portal += d.portal;
    email += d.email;
    if (
      d.next &&
      (visited.has(d.next) || (cursor && d.next <= cursor) || pages >= 10000)
    )
      throw Error("WORKER_PAGINATION_INVALID");
    if (d.next) visited.add(d.next);
    cursor = d.next || "";
  } while (cursor);
  return { pages, portal, email };
}
export function startWorker(task, { intervalMs, label }) {
  let timer,
    stopped = false;
  const controller = new AbortController();
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    controller.abort();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  async function tick() {
    try {
      await task(controller.signal);
      if (!stopped) console.log(label + " completed.");
    } catch {
      if (!stopped) console.error(label + " unavailable; retry scheduled.");
    }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  }
  void tick();
  return { stop };
}

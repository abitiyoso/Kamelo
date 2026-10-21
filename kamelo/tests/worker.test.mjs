import test from "node:test";
import assert from "node:assert/strict";
import {
  workerOrigin,
  workerConfiguration,
  requestJob,
  drainReminderPages,
  startWorker,
} from "../lib/worker-client.mjs";
import { setTimeout as wait } from "node:timers/promises";
const env = {
    APP_URL: "http://127.0.0.1:3001",
    OPERATIONS_JOB_KEY: "a".repeat(64),
  },
  config = workerConfiguration(env);
test("worker origin rejects unsafe transport, credentials, route/query and malformed secrets", () => {
  for (const origin of [
    "http://remote.example.test",
    "ftp://example.test",
    "https://user:secret@example.test",
    "https://example.test/path",
    "https://example.test/?token=private",
    "https://example.test/#private",
    "not-a-url",
  ])
    assert.throws(() => workerOrigin(origin), /WORKER_ORIGIN_INVALID/);
  for (const origin of [
    "https://example.test",
    "http://localhost:3000",
    "http://[::1]:3000",
  ])
    assert(workerOrigin(origin));
  for (const key of [
    "",
    "a".repeat(63),
    "a".repeat(64) + "\n",
    "a".repeat(4097),
  ])
    assert.throws(
      () => workerConfiguration({ ...env, OPERATIONS_JOB_KEY: key }),
      /WORKER_KEY_INVALID/,
    );
  assert.equal(
    workerConfiguration(
      { OPERATIONS_JOB_KEY: env.OPERATIONS_JOB_KEY },
      env.APP_URL,
    ).origin,
    env.APP_URL,
  );
});
test("worker uses a fixed origin, POST, redirect rejection and strips untrusted response fields", async () => {
  let call;
  const result = await requestJob(config, "/api/jobs/mail", {
    fetcher: async (url, options) => {
      call = { url: String(url), options };
      return new Response(
        JSON.stringify({ processed: 2, secret: "must-not-echo" }),
      );
    },
  });
  assert.deepEqual(result, { processed: 2 });
  assert.equal(call.url, env.APP_URL + "/api/jobs/mail");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.redirect, "error");
  assert.equal(
    call.options.headers.Authorization,
    "Bearer " + env.OPERATIONS_JOB_KEY,
  );
  assert(call.options.signal instanceof AbortSignal);
  let calls = 0;
  await assert.rejects(
    requestJob(config, "https://evil.test", {
      fetcher: () => {
        calls++;
      },
    }),
    /WORKER_ROUTE_INVALID/,
  );
  await assert.rejects(
    requestJob({ ...config, origin: "http://evil.test" }, "/api/jobs/mail", {
      fetcher: () => {
        calls++;
      },
    }),
    /WORKER_ORIGIN_INVALID/,
  );
  assert.equal(calls, 0);
});
test("worker sanitizes network/server/JSON failures and rejects invalid counts/cursors", async () => {
  for (const response of [
    new Response("secret response", { status: 500 }),
    new Response("not-json"),
    new Response(JSON.stringify({ processed: -1 })),
    new Response(JSON.stringify({ processed: 0.1 })),
    new Response("x".repeat(16385)),
  ])
    await assert.rejects(
      requestJob(config, "/api/jobs/mail", { fetcher: async () => response }),
      { message: "WORKER_REQUEST_FAILED" },
    );
  await assert.rejects(
    requestJob(config, "/api/jobs", {
      fetcher: async () => {
        throw Error("secret host " + env.OPERATIONS_JOB_KEY);
      },
    }),
    { message: "WORKER_REQUEST_FAILED" },
  );
  await assert.rejects(
    requestJob(config, "/api/jobs/mail", { cursor: "a" }),
    /WORKER_CURSOR_INVALID/,
  );
  await assert.rejects(
    requestJob(config, "/api/jobs/reminders", {
      fetcher: async () =>
        new Response(
          JSON.stringify({ ok: true, portal: 0, email: 0, next: "" }),
        ),
    }),
    /WORKER_REQUEST_FAILED/,
  );
});
test("reminder cursor progresses, rejects repeated/backward pages and respects cancellation", async () => {
  const urls = [];
  let calls = 0;
  assert.deepEqual(
    await drainReminderPages(config, {
      fetcher: async (url) => {
        urls.push(String(url));
        return new Response(
          JSON.stringify({
            ok: true,
            portal: 1,
            email: 2,
            next: ++calls === 1 ? "property-b" : null,
          }),
        );
      },
    }),
    { pages: 2, portal: 2, email: 4 },
  );
  assert(urls[1].endsWith("after=property-b"));
  let n = 0;
  await assert.rejects(
    drainReminderPages(config, {
      fetcher: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            portal: 0,
            email: 0,
            next: ++n === 1 ? "z" : "a",
          }),
        ),
    }),
    /WORKER_PAGINATION_INVALID/,
  );
  const c = new AbortController();
  c.abort();
  await assert.rejects(
    drainReminderPages(config, {
      signal: c.signal,
      fetcher: async () => assert.fail("Must not contact server"),
    }),
    /WORKER_STOPPED/,
  );
});
test("worker scheduler has no overlapping runs and aborts in-flight work on stop", async () => {
  let running = 0,
    max = 0,
    calls = 0,
    observed;
  const worker = startWorker(
    async (signal) => {
      observed = signal;
      max = Math.max(max, ++running);
      calls++;
      await wait(12);
      running--;
    },
    { intervalMs: 1, label: "Synthetic QA worker" },
  );
  await wait(30);
  worker.stop();
  const before = calls;
  await wait(20);
  assert.equal(max, 1);
  assert.equal(calls, before);
  assert(observed.aborted);
});

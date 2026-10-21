import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { workerConfiguration, requestJob } from "../lib/worker-client.mjs";
async function server(handler) {
  const s = createServer(handler);
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  return {
    s,
    origin: "http://127.0.0.1:" + s.address().port,
    async close() {
      s.closeAllConnections();
      await new Promise((r) => s.close(r));
    },
  };
}
test("real loopback HTTP transport refuses redirect and aborts an in-flight request", async () => {
  const seen = [];
  const fixture = await server((q, r) => {
    seen.push(q.url);
    r.writeHead(302, { Location: "/must-not-follow" });
    r.end("private upstream body");
  });
  try {
    const config = workerConfiguration({
      APP_URL: fixture.origin,
      OPERATIONS_JOB_KEY: "q".repeat(64),
    });
    await assert.rejects(requestJob(config, "/api/jobs/mail"), {
      message: "WORKER_REQUEST_FAILED",
    });
    assert.deepEqual(seen, ["/api/jobs/mail"]);
  } finally {
    await fixture.close();
  }
  let contacted;
  const observed = new Promise((r) => {
      contacted = r;
    }),
    pending = await server(() => contacted());
  try {
    const controller = new AbortController(),
      request = requestJob(
        workerConfiguration({
          APP_URL: pending.origin,
          OPERATIONS_JOB_KEY: "q".repeat(64),
        }),
        "/api/jobs/mail",
        { signal: controller.signal },
      );
    const check = assert.rejects(request, { message: "WORKER_STOPPED" });
    await observed;
    controller.abort();
    await check;
  } finally {
    await pending.close();
  }
});
test("all three actual worker entry points execute only fixed loopback jobs with valid secret", async () => {
  const seen = [],
    key = "w".repeat(64),
    fixture = await server((q, r) => {
      assert.equal(q.method, "POST");
      assert.equal(q.headers.authorization, "Bearer " + key);
      seen.push(q.url);
      r.setHeader("Content-Type", "application/json");
      const path = new URL(q.url, "http://localhost").pathname;
      r.end(
        JSON.stringify(
          path === "/api/jobs"
            ? { ok: true, issued: 0 }
            : path === "/api/jobs/mail"
              ? { processed: 0 }
              : {
                  ok: true,
                  portal: 0,
                  email: 0,
                  next: q.url.includes("after=") ? null : "property-b",
                },
        ),
      );
    });
  try {
    for (const name of ["operations", "mail", "reminder"]) {
      const child = spawn(process.execPath, [`scripts/${name}-worker.mjs`], {
        env: {
          ...process.env,
          APP_URL: fixture.origin,
          OPERATIONS_JOB_KEY: key,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      let output = "";
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(Error("Worker smoke timed out")),
            5000,
          );
          child.stdout.on("data", (b) => {
            output += b.toString();
            if (output.includes("completed.")) {
              clearTimeout(timeout);
              resolve();
            }
          });
          child.once("error", (e) => {
            clearTimeout(timeout);
            reject(e);
          });
          child.once("exit", (code) => {
            if (code !== null) {
              clearTimeout(timeout);
              reject(Error("Worker exited before job completion"));
            }
          });
        });
        assert(!output.includes(key));
      } finally {
        child.kill();
        await once(child, "exit");
      }
    }
    assert.deepEqual(seen, [
      "/api/jobs",
      "/api/jobs/mail",
      "/api/jobs/reminders",
      "/api/jobs/reminders?after=property-b",
    ]);
  } finally {
    await fixture.close();
  }
});

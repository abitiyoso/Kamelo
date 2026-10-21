import test from "node:test";
import assert from "node:assert/strict";
import { integrationPreflight } from "../lib/integration-preflight.mjs";
import { spawnSync } from "node:child_process";
test("preflight CLI produces a report but refuses live acceptance even with configuration flags", () => {
  const env = {
    ...process.env,
    APP_URL: "https://app.example.test",
    MAIL_DRIVER: "smtp",
    MAIL_LIVE_ENABLED: "true",
    MAIL_TEST_RECIPIENTS: "synthetic-private@example.test",
    SMTP_USERNAME: "synthetic-secret-user",
    SMTP_PASSWORD: "synthetic-secret-password",
  };
  const report = spawnSync(
    process.execPath,
    ["scripts/integration-preflight.mjs"],
    { env, encoding: "utf8" },
  );
  assert.equal(report.status, 0);
  assert.equal(
    JSON.parse(report.stdout).liveAcceptance,
    "PENDING_EXTERNAL_SETUP",
  );
  const gate = spawnSync(
    process.execPath,
    ["scripts/integration-preflight.mjs", "--require-live"],
    { env, encoding: "utf8" },
  );
  assert.equal(gate.status, 2);
  assert(!gate.stdout.includes(env.SMTP_PASSWORD));
  assert(!gate.stdout.includes(env.SMTP_USERNAME));
});
test("offline preflight distinguishes configuration from real acceptance without exposing secret values", () => {
  const env = {
    APP_URL: "https://private-app.example.test",
    DATABASE_URL: "postgresql://private:secret@private-db.example.test/db",
    OPERATIONS_JOB_KEY: "b".repeat(64),
    DATA_ENCRYPTION_KEY: "c".repeat(64),
    PROOF_STORAGE_DIR: "C:/private-proof-vault",
    MAIL_DRIVER: "smtp",
    MAIL_LIVE_ENABLED: "true",
    MAIL_TEST_RECIPIENTS: "private-qa@example.test",
    SMTP_USERNAME: "private-sender@example.test",
    SMTP_PASSWORD: "private-password",
  };
  const report = integrationPreflight(env),
    text = JSON.stringify(report);
  assert.equal(report.networkRequests, 0);
  assert.equal(report.liveAcceptance, "PENDING_EXTERNAL_SETUP");
  assert.equal(report.application.worker, "CONFIGURED_UNVERIFIED");
  assert.equal(report.application.database, "CONFIGURED_UNVERIFIED");
  assert.equal(report.services[0].state, "UNVERIFIED");
  assert(report.services.every((r) => r.liveVerified === false));
  for (const value of Object.values(env).filter((v) => v.length > 12))
    assert(!text.includes(value));
  assert(
    report.services
      .find((r) => r.key === "iot")
      .requirements.some((r) => r.includes("adapter live")),
  );
});
test("missing/invalid configurations never become live or leak parsing exceptions", () => {
  for (const env of [
    {},
    { APP_URL: "http://remote.example.test", MAIL_DRIVER: "sink" },
    { APP_URL: "https://secret:password@host.test", OPERATIONS_JOB_KEY: "x" },
  ]) {
    const report = integrationPreflight(env);
    assert.equal(report.application.worker, "NEEDS_SETUP");
    assert.equal(report.networkRequests, 0);
    assert(!JSON.stringify(report).includes("password"));
    assert(report.services.every((r) => !r.liveVerified));
  }
  assert.equal(
    integrationPreflight({
      APP_URL: "http://127.0.0.1:3001",
      MAIL_DRIVER: "sink",
    }).services[0].state,
    "LOCAL_ONLY",
  );
});

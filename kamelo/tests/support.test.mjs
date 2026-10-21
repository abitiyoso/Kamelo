import test from "node:test";
import assert from "node:assert/strict";
import { supportNext } from "../lib/support-rules.mjs";
import { integrationReadiness } from "../lib/integration-readiness.mjs";
test("support transitions require reopen and distinguish owner closure from platform resolution", () => {
  assert.equal(supportNext("PLATFORM_ADMIN", "claim", "OPEN"), "IN_PROGRESS");
  assert.equal(
    supportNext("OWNER", "reply", "WAITING_CUSTOMER"),
    "IN_PROGRESS",
  );
  assert.equal(supportNext("OWNER", "status", "RESOLVED", "CLOSED"), "CLOSED");
  assert.equal(supportNext("OWNER", "reopen", "CLOSED"), "OPEN");
  for (const args of [
    ["OWNER", "claim", "OPEN"],
    ["OWNER", "status", "OPEN", "RESOLVED"],
    ["PLATFORM_ADMIN", "status", "OPEN", "CLOSED"],
    ["OWNER", "reply", "CLOSED"],
    ["PLATFORM_ADMIN", "reply", "RESOLVED"],
    ["OWNER", "reopen", "OPEN"],
  ])
    assert.throws(() => supportNext(...args));
});
test("integration readiness never equates configured credentials with a verified live connection or exposes secrets", () => {
  const env = {
    APP_URL: "https://app.example.test",
    MAIL_DRIVER: "smtp",
    MAIL_LIVE_ENABLED: "true",
    MAIL_TEST_RECIPIENTS: "qa@example.test",
    SMTP_USERNAME: "private@example.test",
    SMTP_PASSWORD: "private-password",
    SMTP_PORT: "465",
  };
  assert.equal(integrationReadiness(env)[0].state, "UNVERIFIED");
  assert.equal(
    integrationReadiness({ ...env, MAIL_LIVE_ENABLED: "false" })[0].state,
    "BLOCKED",
  );
  assert.equal(
    integrationReadiness({ ...env, SMTP_PORT: "25" })[0].state,
    "NEEDS_SETUP",
  );
  assert.equal(
    integrationReadiness({ ...env, MAIL_DRIVER: "sink" })[0].state,
    "NEEDS_SETUP",
  );
  assert.equal(
    integrationReadiness({
      APP_URL: "http://127.0.0.1",
      MAIL_DRIVER: "sink",
    })[0].state,
    "LOCAL_ONLY",
  );
  const json = JSON.stringify(integrationReadiness(env));
  for (const secret of [
    env.SMTP_USERNAME,
    env.SMTP_PASSWORD,
    env.MAIL_TEST_RECIPIENTS,
  ])
    assert.ok(!json.includes(secret));
  assert.ok(!integrationReadiness(env).some((r) => r.state === "CONNECTED"));
});

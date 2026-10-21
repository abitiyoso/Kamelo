import test from "node:test";
import assert from "node:assert/strict";
import { renderEmail, emailLink } from "../lib/email/templates.mjs";
import {
  emailConfig,
  smtpOptions,
  deliverEmail,
  emailFailure,
} from "../lib/email/transport.mjs";
import catalog from "../lib/email/catalog.json" with { type: "json" };
import { identityPolicy } from "../lib/identity-policy.mjs";
test("identity policy defaults and configured limits are bounded", () => {
  assert.deepEqual(identityPolicy({}), {
    verificationMinutes: 10,
    resetMinutes: 60,
    maxAttempts: 5,
    resendSeconds: 60,
  });
  assert.equal(identityPolicy({ IDENTITY_MAX_ATTEMPTS: "3" }).maxAttempts, 3);
  assert.throws(() => identityPolicy({ IDENTITY_MAX_ATTEMPTS: "0" }));
  assert.throws(() => identityPolicy({ IDENTITY_VERIFICATION_MINUTES: "900" }));
});
test("all approved transactional drafts render escaped HTML and plain text", () => {
  for (const [id, t] of Object.entries(catalog)) {
    const keys = [
      ...(t.subject + t.body + t.preheader).matchAll(/{{([a-z_]+)}}/g),
    ].map((m) => m[1]);
    const values = Object.fromEntries(
      keys.map((k) => [
        k,
        k.startsWith("url_")
          ? "https://kamelo.example/account"
          : "<script>alert(1)</script>",
      ]),
    );
    const result = renderEmail(id, values, "https://kamelo.example");
    assert.ok(!result.html.includes("<script>"));
    assert.ok(!result.text.includes("{{"));
    assert.ok(result.html.includes("max-width:600px"));
  }
  assert.throws(() => renderEmail("01", {}, "https://kamelo.example"));
  assert.throws(() =>
    renderEmail(
      "01",
      { nama: "X", url_verifikasi: "https://attacker.test" },
      "https://kamelo.example",
    ),
  );
  assert.throws(() =>
    emailLink("https://kamelo.example", "https://attacker.test"),
  );
});
test("SMTP readiness enforces TLS and disables unsafe attachment access", () => {
  for (const port of [465, 587]) {
    const o = smtpOptions({
      SMTP_USERNAME: "synthetic",
      SMTP_PASSWORD: "synthetic",
      SMTP_PORT: String(port),
    });
    assert.equal(o.secure, port === 465);
    assert.equal(o.requireTLS, port === 587);
    assert.equal(o.tls.rejectUnauthorized, true);
    assert.equal(o.disableFileAccess, true);
    assert.equal(o.disableUrlAccess, true);
  }
  assert.throws(() => smtpOptions({ SMTP_HOST: "evil.test" }));
  assert.throws(() => smtpOptions({ SMTP_PORT: "25" }));
  assert.throws(() => smtpOptions({}));
});
test("external delivery fails closed without explicit live gate AND approved recipient", async () => {
  assert.throws(() =>
    emailConfig({ MAIL_DRIVER: "sink", APP_URL: "https://kamelo.example" }),
  );
  for (const env of [
    {},
    { MAIL_LIVE_ENABLED: "true" },
    { MAIL_TEST_RECIPIENTS: "qa@example.test" },
  ])
    await assert.rejects(
      deliverEmail({ to: "qa@example.test" }, "synthetic", {
        APP_URL: "https://kamelo.example",
        MAIL_DRIVER: "smtp",
        ...env,
      }),
      /MAIL_SEND_BLOCKED/,
    );
  assert.equal(emailFailure({}).status, "UNKNOWN");
  assert.equal(emailFailure({ command: "DATA" }).retry, false);
  assert.equal(emailFailure({ command: "CONN" }).retry, true);
  assert.equal(emailFailure({ responseCode: 550 }).status, "FAILED");
  assert.equal(emailFailure({ blocked: true }).status, "BLOCKED");
});

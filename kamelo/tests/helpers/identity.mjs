// QA fixture helper: follows the real email challenge, never changes verification in SQL.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
export async function challengeToken(db, userId, purpose = "EMAIL_VERIFY") {
  const c = await db.identityChallenge.findFirst({
    where: { userId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(c, "challenge issued");
  const out = await db.emailOutbox.findUniqueOrThrow({
    where: { dedupeKey: "challenge:" + c.id },
  });
  assert.equal(
    out.status,
    "SINKED",
    "tests require local sink; no external email",
  );
  const m = JSON.parse(
    await readFile(`.local-secrets/mail-sink/${out.id}.json`, "utf8"),
  );
  return /token=([a-zA-Z0-9_-]+\.[a-f0-9]{64})/.exec(m.text)[1];
}
export async function verifiedFixture(db, base, cookie, email) {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  if (u.emailVerifiedAt) return;
  const token = await challengeToken(db, u.id);
  const r = await fetch(base + "/api/account", {
    method: "POST",
    headers: {
      Origin: base,
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "verify", token }),
  });
  assert.equal(r.status, 200, await r.text());
}
export async function staffFixture(db, base, ownerCookie, input) {
  async function call(path, body, cookie = ownerCookie) {
    const r = await fetch(base + path, {
      method: "POST",
      headers: {
        Origin: base,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return {
      status: r.status,
      cookie: r.headers.get("set-cookie")?.split(";")[0],
      ...(await r.json()),
    };
  }
  const invite = await call("/api/invitations", {
    action: "create",
    kind: "STAFF",
    email: input.email,
    propertyIds: input.propertyIds,
  });
  if (invite.status !== 200) return invite;
  const inv = await db.invitation.findUniqueOrThrow({
    where: { id: invite.result.id },
  });
  const out = await db.emailOutbox.findFirstOrThrow({
    where: { dedupeKey: { startsWith: `invite:${inv.id}:` } },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(out.status, "SINKED");
  const m = JSON.parse(
    await readFile(`.local-secrets/mail-sink/${out.id}.json`, "utf8"),
  );
  const token = /token=([a-f0-9]{64})/.exec(m.text)[1];
  const signup = await call(
    "/api/auth",
    { action: "register", ...input, invitationToken: token },
    "",
  );
  assert.equal(signup.status, 200, JSON.stringify(signup));
  await verifiedFixture(db, base, signup.cookie, input.email);
  const accepted = await call(
    "/api/invitations",
    { action: "accept", token },
    signup.cookie,
  );
  assert.equal(accepted.status, 200, JSON.stringify(accepted));
  const u = await db.user.findUniqueOrThrow({ where: { email: input.email } });
  return { status: 200, result: { id: u.id } };
}

import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
export function emailConfig(env = process.env) {
  const driver =
    env.MAIL_DRIVER ||
    (env.MAIL_ENDPOINT && env.MAIL_API_KEY ? "legacy" : "disabled");
  const origin = new URL(env.APP_URL || "http://invalid");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !local)
    throw Error("EMAIL_ORIGIN_INVALID");
  if (driver === "sink" && !local) throw Error("EMAIL_SINK_LOCAL_ONLY");
  const live = env.MAIL_LIVE_ENABLED === "true";
  return {
    driver,
    live,
    origin: origin.origin,
    from: {
      name: env.EMAIL_FROM_NAME || "Kamelo by ELENIO",
      address: env.EMAIL_FROM_ADDRESS || "hello@elenio.id",
    },
    replyTo: env.EMAIL_REPLY_TO || "hello@elenio.id",
    allowlist: (env.MAIL_TEST_RECIPIENTS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    env,
  };
}
export function smtpOptions(env = process.env) {
  const host = env.SMTP_HOST || "smtp.hostinger.com",
    port = Number(env.SMTP_PORT || 465);
  if (host !== "smtp.hostinger.com" || ![465, 587].includes(port))
    throw Error("SMTP_CONFIGURATION_INVALID");
  if (!env.SMTP_USERNAME || !env.SMTP_PASSWORD)
    throw Error("SMTP_CREDENTIALS_MISSING");
  return {
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user: env.SMTP_USERNAME, pass: env.SMTP_PASSWORD },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  };
}
export async function deliverEmail(message, id, env = process.env) {
  const c = emailConfig(env);
  if (c.driver === "sink") {
    const directory = path.resolve(".local-secrets/mail-sink");
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, id + ".json"),
      JSON.stringify({ ...message, from: c.from, replyTo: c.replyTo }),
      { flag: "wx", mode: 0o600 },
    ).catch((e) => {
      if (e.code !== "EEXIST") throw e;
    });
    return { status: "SINKED", messageId: id };
  }
  if (!c.live || !c.allowlist.includes(message.to.toLowerCase()))
    throw Object.assign(Error("MAIL_SEND_BLOCKED"), { blocked: true });
  if (c.driver === "smtp") {
    const result = await nodemailer
      .createTransport(smtpOptions(env))
      .sendMail({
        ...message,
        from: c.from,
        replyTo: c.replyTo,
        messageId: `<${id}@elenio.id>`,
      });
    if (!result.accepted?.length) throw Error("SMTP_NOT_ACCEPTED");
    return { status: "ACCEPTED", messageId: result.messageId };
  }
  if (c.driver === "legacy") {
    const endpoint = new URL(env.MAIL_ENDPOINT);
    if (
      endpoint.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(endpoint.hostname)
    )
      throw Error("MAIL_ENDPOINT_INVALID");
    const r = await fetch(endpoint, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(30000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.MAIL_API_KEY}`,
        "Idempotency-Key": id,
      },
      body: JSON.stringify({ ...message, from: c.from, replyTo: c.replyTo }),
    });
    if (!r.ok)
      throw Object.assign(Error("MAIL_ENDPOINT_REJECTED"), {
        responseCode: r.status,
      });
    return { status: "ACCEPTED", messageId: id };
  }
  throw Object.assign(Error("MAIL_SEND_BLOCKED"), { blocked: true });
}
export function emailFailure(error) {
  if (error.blocked)
    return { status: "BLOCKED", code: "MAIL_SEND_BLOCKED", retry: false };
  if (error.responseCode >= 500 && error.responseCode < 600)
    return { status: "FAILED", code: "PROVIDER_REJECTED", retry: false };
  if (
    (error.responseCode >= 400 && error.responseCode < 500) ||
    ["CONN", "EHLO", "STARTTLS", "AUTH"].includes(error.command)
  )
    return { status: "QUEUED", code: "PROVIDER_UNAVAILABLE", retry: true };
  return { status: "UNKNOWN", code: "DELIVERY_UNCERTAIN", retry: false };
}

import catalog from "./catalog.json" with { type: "json" };
export const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function emailLink(origin, route, fragment = "") {
  const base = new URL(origin),
    url = new URL(route, base);
  if (
    url.origin !== base.origin ||
    (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) &&
      base.protocol !== "https:")
  )
    throw Error("EMAIL_LINK_INVALID");
  url.hash = fragment;
  return url.href;
}
export function renderEmail(template, values, origin) {
  const t = catalog[template];
  if (!t) throw Error("EMAIL_TEMPLATE_UNKNOWN");
  const replace = (source, html = false) =>
    source.replace(/{{([a-z_]+)}}/g, (_, key) => {
      if (values[key] === undefined)
        throw Error("EMAIL_TEMPLATE_FIELD_MISSING");
      const v = String(values[key]);
      if (
        key.startsWith("url_") &&
        new URL(v).origin !== new URL(origin).origin
      )
        throw Error("EMAIL_LINK_INVALID");
      return html ? escapeHtml(v) : v;
    });
  const subject = replace(t.subject).replace(/[\r\n]/g, " "),
    text = replace(t.body),
    pre = replace(t.preheader);
  const paragraphs = text
    .split(/\n\n/)
    .map((p) => {
      const m = p.match(/^CTA: (.*?) → (https?:\/\/\S+)$/);
      return m
        ? `<p><a style="display:inline-block;background:#0d4434;color:white;padding:13px 20px;border-radius:9px;text-decoration:none" href="${escapeHtml(m[2])}">${escapeHtml(m[1])}</a></p>`
        : `<p style="line-height:1.65">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
  const logo = emailLink(origin, "/brand/kamelo-backoffice.png");
  return {
    subject,
    text: text + "\n\nKamelo by ELENIO · PT Elenio Digital Indonesia",
    html: `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f8f7f3;color:#1c3129;font:15px Arial,sans-serif"><span style="display:none">${escapeHtml(pre)}</span><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" style="width:100%;max-width:600px;background:#fff;border:1px solid #e4e9e3;border-radius:16px"><tr><td style="padding:28px"><img src="${escapeHtml(logo)}" width="160" alt="Kamelo by ELENIO" style="max-width:100%;height:auto">${paragraphs}<hr style="border:0;border-top:1px solid #e4e9e3"><p style="font-size:12px;color:#74827a">Kamelo by ELENIO · PT Elenio Digital Indonesia</p></td></tr></table></td></tr></table></body></html>`,
  };
}

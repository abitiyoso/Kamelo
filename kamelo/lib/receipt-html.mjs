const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function receiptHtml(doc, logo = "") {
  const s = doc.snapshot,
    rupiah = (n) =>
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(n);
  const status = {
    ACTIVE: "Penerimaan aktif",
    CORRECTED:
      "Catatan telah dikoreksi — kuitansi ini tidak berlaku sebagai penerimaan aktif",
    REFUNDED: "Dana telah dikembalikan seluruhnya",
    PARTIALLY_REFUNDED: "Sebagian dana telah dikembalikan",
  }[doc.state.status];
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kuitansi ${esc(doc.number)}</title><style>body{font:16px Arial,sans-serif;color:#173b30;background:#f8f7f3;margin:0;padding:32px}main{max-width:760px;margin:auto;background:white;border:1px solid #dfe7df;padding:32px;border-radius:16px}img{width:160px}h1{font-size:28px}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:12px 0;border-bottom:1px solid #e5ebe5;overflow-wrap:anywhere}th{width:38%}.amount{font-size:30px;font-weight:bold}.notice{padding:16px;background:#f2efe3;border-radius:8px}small{display:block;overflow-wrap:anywhere;line-height:1.7}@media print{body{background:white;padding:0}main{border:0;padding:12px}}@media(max-width:480px){body{padding:12px}main{padding:20px}th{width:42%}.amount{font-size:25px}}</style></head><body><main>${logo ? `<img alt="Kamelo by ELENIO" src="data:image/png;base64,${logo}">` : ""}<h1>Kuitansi pembayaran</h1><p>${esc(doc.number)}</p><p class="amount">${esc(rupiah(s.amount))}</p><table>${row("Pengelola", s.organization)}${row("Properti", s.property)}${row("Diterima dari", s.guest)}${s.room ? row("Kamar", s.room) : ""}${row("Sumber", s.source === "INVOICE" ? "Invoice" : "Saldo awal")}${row("Tagihan", s.sourceReference)}${row("Tanggal diterima", s.date)}${row("Metode", s.method)}${row("Referensi", s.reference)}</table><p class="notice">${esc(status)}. Pengembalian tercatat: ${esc(rupiah(doc.state.refunded))}. Penerimaan yang masih tercatat: ${esc(rupiah(doc.state.retained))}.</p><small>Diterbitkan ${esc(new Date(doc.issuedAt).toISOString())}. Status sumber diperiksa saat dokumen ini dibuka. Salinan yang diunduh dapat menjadi kedaluwarsa; periksa portal untuk status terbaru.</small><small>Ini kuitansi pencatatan pengelola, bukan faktur pajak atau dokumen dengan tanda tangan elektronik tersertifikasi. Tidak memindahkan dana.</small><small>Checksum arsip SHA-256: ${esc(doc.snapshotHash)}. Checksum memeriksa konsistensi arsip, bukan tanda tangan digital.</small></main></body></html>`;
}

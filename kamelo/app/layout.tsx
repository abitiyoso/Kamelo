import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kamelo by ELENIO — Dari Masalah Properti, Jadi Tindakan Nyata.",
  description:
    "Tagihan belum masuk, follow-up staf dan biaya operasional sulit dipantau? Kamelo membantu owner kos, guest house dan hotel kecil mulai dari kamar, tagihan dan pembayaran.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

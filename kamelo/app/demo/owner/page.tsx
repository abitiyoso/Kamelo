import Link from "next/link";
import { Header, Footer } from "@/components/brand";
import { ReminderDemo } from "@/components/reminder-demo";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const hotel = (await searchParams).property === "hotel";
  return (
    <>
      <Header />
      <main className="container owner-demo-page">
        <span className="eyebrow">COBA DEMO OWNER</span>
        <h1>Dari tagihan ke pesan yang siap ditinjau.</h1>
        <p>
          Pilih penghuni, siapkan pengingat, salin pesan, lalu ulangi. Seluruh
          interaksi memakai data contoh dan state lokal.
        </p>
        <ReminderDemo key={hotel ? "hotel" : "kos"} hotel={hotel} />
        <div className="demo-route-links">
          <Link
            className="text-link"
            href={"/demo?tab=billing" + (hotel ? "&property=hotel" : "")}
          >
            Lihat contoh daftar tagihan →
          </Link>
          <Link
            className="text-link"
            href={"/demo/tenant" + (hotel ? "?property=hotel" : "")}
          >
            Lihat Contoh Portal Penghuni →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { AdminPanel } from "@/components/admin-panel";
import { Brand } from "@/components/brand";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.platformAdmin)
    return (
      <main className="container legal">
        <h1>Akses ditolak</h1>
        <p>Halaman ini hanya untuk administrator platform terverifikasi.</p>
        <a href="/app/dashboard">Kembali ke dashboard</a>
      </main>
    );
  const organizations = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      _count: { select: { properties: true, users: true } },
    },
    take: 100,
  });
  const requests = await db.upgrade.findMany({
    where: { status: "REQUESTED" },
    include: { organization: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <main className="container legal">
      <Brand />
      <h1>Administrasi platform</h1>
      <p>
        Akses administrator terverifikasi · perubahan paket tercatat dalam
        audit.
      </p>
      <AdminPanel requests={JSON.parse(JSON.stringify(requests))} />
      <h2>Organisasi</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Paket</th>
              <th>Properti</th>
              <th>Pengguna</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((o) => (
              <tr key={o.id}>
                <td>{o.name}</td>
                <td>{o.plan}</td>
                <td>{o._count.properties}</td>
                <td>{o._count.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a className="button secondary" href="/app/dashboard">
        Kembali ke aplikasi
      </a>
    </main>
  );
}

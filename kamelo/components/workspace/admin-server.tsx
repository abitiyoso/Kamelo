import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminWorkspace } from "@/components/workspace/admin";
export async function AdminPage({
  initialPage = "organizations",
}: { initialPage?: string } = {}) {
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
  if (user.role !== "PLATFORM_ADMIN")
    return (
      <main className="container legal">
        <h1>Pilih workspace Platform ELENIO</h1>
        <p>
          Gunakan workspace platform untuk mengelola pelanggan dan penagihan
          SaaS.
        </p>
        <a href="/workspaces">Pilih workspace</a>
      </main>
    );
  return (
    <AdminWorkspace
      initialPage={initialPage}
      name={user.name}
      email={user.email}
    />
  );
}

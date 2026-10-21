"use client";
type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  propertyIds: string[];
  canRecordPayments: boolean;
  canControlDevices: boolean;
};
export function Team({
  members,
  properties,
  disabled,
  mutate,
}: {
  members: Member[];
  properties: { id: string; name: string }[];
  disabled: boolean;
  mutate: (action: string, data: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <section className="panel settings-panel">
      <h2>Pengguna & Staf</h2>
      <p>
        Pemilik mengelola properti dan langganan. Staf hanya mengakses properti
        yang ditugaskan.
      </p>
      {members.map((m) => (
        <div key={m.id} className="stay-detail">
          <div>
            <b>{m.name}</b>
            <p>
              {m.email} · {m.role}
            </p>
          </div>
          {m.role === "STAFF" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                await mutate("teamAssign", {
                  userId: m.id,
                  propertyIds: d.getAll("propertyIds"),
                  canRecordPayments: d.get("canRecordPayments") === "on",
                  canControlDevices: d.get("canControlDevices") === "on",
                });
              }}
            >
              {properties.map((p) => (
                <label className="checkbox" key={p.id}>
                  <input
                    type="checkbox"
                    name="propertyIds"
                    value={p.id}
                    defaultChecked={m.propertyIds.includes(p.id)}
                    disabled={disabled}
                  />
                  {p.name}
                </label>
              ))}
              <label className="checkbox">
                <input
                  name="canRecordPayments"
                  type="checkbox"
                  defaultChecked={m.canRecordPayments}
                  disabled={disabled}
                />
                Izinkan pencatatan pembayaran
              </label>
              <label className="checkbox">
                <input
                  name="canControlDevices"
                  type="checkbox"
                  defaultChecked={m.canControlDevices}
                  disabled={disabled}
                />
                Izinkan kontrol perangkat
              </label>
              <button className="secondary" disabled={disabled}>
                Simpan Akses
              </button>
            </form>
          )}
        </div>
      ))}
      <p className="notice">Tambahkan anggota melalui Undangan & Akses. Setiap pengguna memakai akun dan email terverifikasi miliknya sendiri.</p>
    </section>
  );
}

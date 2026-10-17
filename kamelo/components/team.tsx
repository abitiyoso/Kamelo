"use client";
import { useState } from "react";
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
  const [adding, setAdding] = useState(false);
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
      {!adding ? (
        <button
          className="secondary"
          disabled={disabled}
          onClick={() => setAdding(true)}
        >
          Tambah Staf
        </button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const d = new FormData(form);
            await mutate("teamAdd", {
              ...Object.fromEntries(d),
              propertyIds: d.getAll("propertyIds"),
              canRecordPayments: d.get("canRecordPayments") === "on",
              canControlDevices: d.get("canControlDevices") === "on",
            });
          }}
        >
          <div className="form-row">
            <label>
              Nama staf
              <input name="name" minLength={2} required />
            </label>
            <label>
              Email staf
              <input name="email" type="email" required />
            </label>
          </div>
          <label>
            WhatsApp
            <input
              name="phone"
              type="tel"
              placeholder="081234567890"
              required
            />
          </label>
          <label>
            Kata sandi awal
            <input
              name="password"
              type="password"
              minLength={10}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </label>
          <p>
            Berikan akses hanya kepada staf yang Anda percaya. Kata sandi tidak
            dicatat dalam audit.
          </p>
          {properties.map((p) => (
            <label className="checkbox" key={p.id}>
              <input name="propertyIds" type="checkbox" value={p.id} />
              {p.name}
            </label>
          ))}
          <label className="checkbox">
            <input name="canRecordPayments" type="checkbox" />
            Izinkan pencatatan pembayaran
          </label>
          <label className="checkbox">
            <input name="canControlDevices" type="checkbox" />
            Izinkan kontrol perangkat
          </label>
          <button disabled={disabled}>Buat Akun Staf</button>
          <button
            className="secondary"
            type="button"
            onClick={() => setAdding(false)}
          >
            Batal
          </button>
        </form>
      )}
    </section>
  );
}

"use client";
import { useState } from "react";
import { roomStatus } from "@/lib/domain.mjs";
import { ClipboardList, BedDouble } from "lucide-react";
import type { OperationTicket } from "../operations-hub";
import { useDialogFocus } from "../dialog-focus";
import { WorkspaceCard, WorkspaceKpi } from "./modules";
const statuses: Record<string, string> = {
  OPEN: "Baru",
  IN_PROGRESS: "Dikerjakan",
  RESOLVED: "Selesai",
};
export function StaffTasks({
  property,
  tickets,
  pending,
  mutate,
}: {
  property: string;
  tickets: OperationTicket[];
  pending: boolean;
  mutate: (action: string, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState("");
  const ticket = tickets.find((t) => t.id === selected);
  useDialogFocus(Boolean(ticket), () => setSelected(null));
  return (
    <>
      <div className="pagehead">
        <div>
          <span className="overline">{property}</span>
          <h2>Pekerjaan Hari Ini</h2>
          <p>
            Tugas yang ditugaskan kepada Anda. Selesaikan dengan progres yang
            tercatat.
          </p>
        </div>
      </div>
      <div className="grid cols3">
        <WorkspaceKpi
          label="Tugas saya"
          value={tickets.length}
          note="Butuh penyelesaian"
        />
        <WorkspaceKpi
          label="Prioritas tinggi"
          value={tickets.filter((t) => t.priority === "URGENT").length}
          note="Dahulukan pekerjaan penting"
        />
        <WorkspaceKpi
          label="Selesai"
          value={tickets.filter((t) => t.status === "RESOLVED").length}
          note="Sudah ditutup"
        />
      </div>
      <div className="space" />
      <WorkspaceCard title="Antrian Tugas">
        <div className="list">
          {tickets.map((t) => (
            <div className="item" key={t.id}>
              <div className="left">
                <span
                  className={"glyph " + (t.priority === "URGENT" ? "red" : "")}
                >
                  <ClipboardList size={18} />
                </span>
                <div>
                  <strong>{t.title}</strong>
                  <small>
                    {t.stay ? "Kamar " + t.stay.room.number : "Area bersama"} ·{" "}
                    {t.category} · {statuses[t.status] || t.status}
                  </small>
                </div>
              </div>
              <button
                className="btn small"
                aria-label={"Buka tugas " + t.title}
                onClick={() => {
                  setError("");
                  setSelected(t.id);
                }}
              >
                Buka
              </button>
            </div>
          ))}
        </div>
        {!tickets.length && (
          <p className="empty">Belum ada tugas yang ditugaskan kepada Anda.</p>
        )}
      </WorkspaceCard>
      {ticket && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-task-title"
          >
            <div className="between">
              <h2 id="staff-task-title">{ticket.title}</h2>
              <button className="btn outline" onClick={() => setSelected(null)}>
                Tutup
              </button>
            </div>
            <p>{ticket.description}</p>
            <ol>
              {ticket.updates.map((u) => (
                <li key={u.id}>
                  <strong>{statuses[u.status]}</strong> · {u.note}
                  <small>{new Date(u.createdAt).toLocaleString("id-ID")}</small>
                </li>
              ))}
            </ol>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <form
              className="ops-form"
              method="post"
              onSubmit={async (e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                setError("");
                try {
                  await mutate("ticketUpdate", {
                    ticketId: ticket.id,
                    status: d.get("status"),
                    note: d.get("note"),
                  });
                  setSelected(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Progres belum dapat disimpan.",
                  );
                }
              }}
            >
              <label>
                Status
                <select name="status" defaultValue={ticket.status}>
                  {Object.entries(statuses).map(([key, label]) => (
                    <option value={key} key={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Catatan progres (terlihat oleh penghuni terkait)
                <textarea name="note" required minLength={3} maxLength={2000} />
              </label>
              <button className="btn" disabled={pending}>
                Simpan progres
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export function StaffRooms({
  rooms,
  today,
  pending,
  mutate,
}: {
  rooms: {
    id: string;
    number: string;
    operational: string;
    stays: { status: string; start: string; end: string | null }[];
  }[];
  today: string;
  pending: boolean;
  mutate: (action: string, body: Record<string, unknown>) => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [error, setError] = useState("");
  const room = rooms.find((r) => r.id === selected),
    available = rooms.filter(
      (r) => roomStatus(r, r.stays, today) !== "OCCUPIED",
    );
  useDialogFocus(Boolean(room), () => setSelected(null));
  return (
    <>
      <div className="pagehead">
        <div>
          <h2>Kesiapan Kamar</h2>
          <p>
            Periksa, bersihkan, dan tandai kesiapan. Okupansi ditentukan oleh
            masa tinggal.
          </p>
        </div>
      </div>
      <WorkspaceCard title="Kamar Membutuhkan Tindakan">
        {available.map((r) => (
          <div className="item" key={r.id}>
            <div className="left">
              <span
                className={
                  "glyph " + (r.operational === "MAINTENANCE" ? "red" : "")
                }
              >
                <BedDouble size={18} />
              </span>
              <div>
                <strong>Kamar {r.number}</strong>
                <small>
                  {r.operational === "MAINTENANCE"
                    ? "Perbaikan dibutuhkan"
                    : r.operational === "CLEANING"
                      ? "Perlu dibersihkan"
                      : "Siap dicek sebelum check-in"}
                </small>
              </div>
            </div>
            <button
              className="btn small"
              aria-label={"Periksa kamar " + r.number}
              onClick={() => {
                setSelected(r.id);
                setError("");
              }}
            >
              Periksa
            </button>
          </div>
        ))}
        {!available.length && (
          <p>Tidak ada kamar kosong yang perlu diperiksa.</p>
        )}
      </WorkspaceCard>
      {room && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-room-title"
          >
            <div className="between">
              <h2 id="staff-room-title">Kamar {room.number}</h2>
              <button className="btn outline" onClick={() => setSelected(null)}>
                Tutup
              </button>
            </div>
            <p>
              Status operasional tidak mengubah tarif, penghuni, atau masa
              tinggal.
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <form
              className="ops-form"
              method="post"
              onSubmit={async (e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                try {
                  await mutate("roomReadiness", {
                    roomId: room.id,
                    operational: d.get("operational"),
                  });
                  setSelected(null);
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "Status belum dapat disimpan.",
                  );
                }
              }}
            >
              <label>
                Status operasional
                <select name="operational" defaultValue={room.operational}>
                  <option value="READY">Siap</option>
                  <option value="CLEANING">Perlu dibersihkan</option>
                  <option value="MAINTENANCE">Perawatan</option>
                </select>
              </label>
              <button className="btn" disabled={pending}>
                Simpan kesiapan
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

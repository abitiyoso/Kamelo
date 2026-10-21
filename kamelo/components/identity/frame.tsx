import type { ReactNode } from "react";
import assets from "@/lib/workspace/assets.json";
import "@/app/workspace.css";
export function IdentityFrame({ children }: { children: ReactNode }) {
  return (
    <div className="bo-root">
      <main className="auth">
        <aside className="authvisual">
          <img
            className="photo-bg"
            src={assets.building}
            alt="Gedung properti"
          />
          <a className="brand-white" href="/">
            <img src={assets.logo} alt="Kamelo by ELENIO" />
          </a>
          <div className="copy">
            <div className="overline" style={{ color: "#d8d2bd" }}>
              Kamelo by ELENIO
            </div>
            <h2>Semua urusan properti, kini lebih terkendali.</h2>
            <p>
              Kelola kamar, penghuni, pembayaran, CCTV, smart room, dan
              pekerjaan harian dalam satu platform.
            </p>
          </div>
        </aside>
        <section className="authcontent">
          <div className="authbox">
            <a href="/">
              <img
                className="brandimg"
                src={assets.logo}
                alt="Kamelo by ELENIO"
              />
            </a>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

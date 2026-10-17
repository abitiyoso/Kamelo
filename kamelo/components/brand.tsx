import Link from "next/link";
import Image from "next/image";
import { MobilePublicMenu } from "./mobile-public-menu";
import { ArrowUpRight, MessageCircle } from "lucide-react";
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className="brand kamelo-brand" aria-label="Kamelo by ELENIO">
      <span className="kamelo-wordmark">
        Kamelo
        <small className="kamelo-attribution">
          <span>by</span>
          <Image
            className="kamelo-parent-logo"
            src={
              inverse
                ? "/brand/elenio-logo-color-white.png"
                : "/brand/elenio-logo.png"
            }
            alt="ELENIO"
            width={292}
            height={64}
            sizes="85px"
          />
        </small>
      </span>
    </Link>
  );
}
export function Header({ home = false }: { home?: boolean }) {
  return (
    <header className={"public-header" + (home ? " home-header" : "")}>
      <div className="container nav">
        <Brand />
        <nav aria-label="Navigasi utama">
          <a href="/#fitur">{home ? "Solusi" : "Solusi Owner"}</a>
          <a href={home ? "/#mulai" : "/#cara-kerja"}>Cara Kerja</a>
          <a href="/#harga">Harga</a>
          {home && <a href="/#faq">FAQ</a>}
        </nav>
        <MobilePublicMenu expanded={home} />
        <div className="nav-actions">
          <Link href="/login">Masuk Owner</Link>
          <Link className="button small" href="/register">
            Mulai Gratis <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
export function Footer({ home = false }: { home?: boolean }) {
  if (home)
    return (
      <footer className="journal-footer">
        <div className="container">
          <div className="journal-footer-main">
            <Brand inverse />
            <nav aria-label="Navigasi footer">
              <a href="/#fitur">Solusi</a>
              <a href="/#mulai">Cara Kerja</a>
              <a href="/#harga">Harga</a>
              <a href="/#faq">FAQ</a>
            </nav>
            <a
              className="journal-footer-contact"
              href="https://wa.me/6281933328899"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={21} />
              <span>
                Hubungi kami<small>via WhatsApp</small>
              </span>
            </a>
            <div className="journal-footer-legal">
              <Link href="/privacy">Privasi</Link>
              <Link href="/terms">Ketentuan</Link>
            </div>
          </div>
          <div className="journal-footer-bottom">
            <small>© {new Date().getFullYear()} Kamelo by ELENIO</small>
            <small>Preview pengembangan · integrasi nyata belum aktif.</small>
          </div>
        </div>
      </footer>
    );
  return (
    <footer className="container">
      <div>
        <Brand />
        <p>Dari Masalah Properti, Jadi Tindakan Nyata.</p>
      </div>
      <div>
        <a href="https://elenio.id">elenio.id ↗</a>
        <a href="https://wa.me/6281933328899">WhatsApp 0819 3332 8899</a>
        <a href="/privacy">Kebijakan Privasi</a>
        <a href="/terms">Syarat Layanan</a>
      </div>
      <small>© {new Date().getFullYear()} Kamelo by ELENIO</small>
    </footer>
  );
}

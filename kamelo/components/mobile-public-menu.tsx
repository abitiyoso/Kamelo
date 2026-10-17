"use client";
import { useRef } from "react";
export function MobilePublicMenu({ expanded = false }: { expanded?: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null),
    summary = useRef<HTMLElement>(null);
  return (
    <details
      className="mobile-public-menu"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape" && ref.current) {
          ref.current.open = false;
          summary.current?.focus();
        }
      }}
    >
      <summary ref={summary}>Menu</summary>
      <nav aria-label="Navigasi mobile">
        {[
          ["Solusi", "fitur"],
          ["Demo", "demo-owner"],
          ["Harga", "harga"],
          ...(expanded
            ? [
                ["Cara mulai", "mulai"],
                ["FAQ", "faq"],
              ]
            : []),
        ].map(([label, id]) => (
          <a
            key={id}
            href={"/#" + id}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
          >
            {label}
          </a>
        ))}
      </nav>
    </details>
  );
}

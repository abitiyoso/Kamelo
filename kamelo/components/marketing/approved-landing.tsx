"use client";
import { useEffect, useRef } from "react";
import { installMarketingKeyboard } from "@/lib/marketing/accessibility";

/** Static, trusted build-time HTML; never receives user-provided content. */
export function ApprovedLanding({ markup }: { markup: string }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    import("@/lib/marketing/showcase-runtime").then(
      ({ initializeShowcase }) => {
        if (!cancelled && root.current) {
          const disposeShowcase = initializeShowcase(root.current);
          const disposeKeyboard = installMarketingKeyboard(root.current);
          cleanup = () => {
            disposeKeyboard();
            disposeShowcase();
          };
        }
      },
    );
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
  return (
    <div
      id="kamelo-public"
      ref={root}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

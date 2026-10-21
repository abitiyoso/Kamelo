"use client";
import { useState } from "react";
import { WorkspaceShell } from "./shell";
import { WorkspaceAccount } from "./modules";
import { CustomerBillingWorkspace } from "./subscriptions";
import { SupportWorkspace } from "./support";
import { PlatformHealthWorkspace } from "./platform-health";
import { PrivacyWorkspace } from "./privacy";
export function AdminWorkspace({
  initialPage,
  name,
  email,
}: {
  initialPage: string;
  name: string;
  email: string;
}) {
  const [page, setPage] = useState(initialPage);
  const [privacy, setPrivacy] = useState(false);
  return (
    <WorkspaceShell
      role="admin"
      page={page}
      onNavigate={(next) => {
        setPage(next);
        history.replaceState(null, "", "/admin/" + next);
      }}
      name={name}
      context="Platform ELENIO"
      onLogout={async () => {
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "logout" }),
        });
        location.href = "/login";
      }}
    >
      {["organizations", "subscriptions"].includes(page) && (
        <CustomerBillingWorkspace
          key={page}
          subscriptions={page === "subscriptions"}
        />
      )}
      {page === "support" && (
        <>
          <div
            className="bo-lifecycle-tabs"
            role="tablist"
            aria-label="Pusat bantuan"
          >
            <button
              role="tab"
              aria-selected={!privacy}
              onClick={() => setPrivacy(false)}
            >
              Bantuan pelanggan
            </button>
            <button
              role="tab"
              aria-selected={privacy}
              onClick={() => setPrivacy(true)}
            >
              Permintaan privasi
            </button>
          </div>
          {privacy ? (
            <PrivacyWorkspace platform />
          ) : (
            <SupportWorkspace platform />
          )}
        </>
      )}
      {page === "integrations" && <PlatformHealthWorkspace />}
      {page === "account" && (
        <WorkspaceAccount
          enabled
          name={name}
          email={email}
          role="Admin ELENIO"
          context="Platform ELENIO"
        />
      )}
    </WorkspaceShell>
  );
}

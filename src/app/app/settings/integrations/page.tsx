"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Connection = {
  id: string | null;
  provider: "meta" | "linkedin" | "google";
  status: string;
  mode: string;
  display_account_name: string | null;
  last_synced_at: string | null;
  permissions_summary: string[];
  last_error: string | null;
};

const LABELS: Record<string, { title: string; subtitle: string }> = {
  meta: { title: "Meta", subtitle: "Facebook + Instagram" },
  linkedin: { title: "LinkedIn", subtitle: "LinkedIn Ads" },
  google: { title: "Google Ads", subtitle: "Search campaigns" },
};

function relativeTime(iso: string | null) {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)} hr ago`;
}

export default function IntegrationsSettingsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [mode, setMode] = useState("SIMULATION");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/integrations");
    const json = await res.json();
    setConnections(json.connections ?? []);
    setMode(json.mode ?? "SIMULATION");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function connect(provider: string) {
    setBusy(provider);
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "connect",
        provider,
        authCode: `sim_${provider}_${Date.now()}`,
      }),
    });
    await refresh();
    setBusy(null);
  }

  async function disconnect(provider: string, connectionId: string) {
    setBusy(provider);
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect", provider, connectionId }),
    });
    await refresh();
    setBusy(null);
  }

  async function retrySync(provider: string, connectionId: string) {
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "retry_sync", provider, connectionId }),
    });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/app/settings" className="text-sm font-semibold text-[var(--altus-blue)]">
            ← Settings
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Marketing Integrations
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
            Connect advertising accounts securely. Tokens stay server-side. Mode:{" "}
            <strong>{mode}</strong>
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {connections.map((conn) => {
          const label = LABELS[conn.provider]!;
          const connected = conn.status === "CONNECTED";
          return (
            <article
              key={conn.provider}
              className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--altus-soft)] text-sm font-bold text-[var(--altus-blue)]">
                    {label.title.slice(0, 2).toUpperCase()}
                  </div>
                  <h2 className="mt-3 text-lg font-bold text-[var(--altus-text)]">{label.title}</h2>
                  <p className="text-xs text-[var(--altus-text-secondary)]">{label.subtitle}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                    connected
                      ? "bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                      : "bg-[var(--altus-section)] text-[var(--altus-text-secondary)]",
                  )}
                >
                  {conn.status.replaceAll("_", " ")}
                </span>
              </div>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--altus-text-secondary)]">Account</dt>
                  <dd className="font-medium">{conn.display_account_name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--altus-text-secondary)]">Last sync</dt>
                  <dd className="font-medium">{relativeTime(conn.last_synced_at)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--altus-text-secondary)]">Permissions</dt>
                  <dd className="max-w-[160px] text-right text-xs font-medium">
                    {conn.permissions_summary.length
                      ? conn.permissions_summary.join(" · ")
                      : "—"}
                  </dd>
                </div>
              </dl>

              {conn.last_error ? (
                <p className="mt-3 text-xs text-red-600">{conn.last_error}</p>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-2">
                {connected && conn.id ? (
                  <>
                    <button
                      type="button"
                      className="rounded-md border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold"
                      onClick={() => retrySync(conn.provider, conn.id!)}
                    >
                      Retry Sync
                    </button>
                    <button
                      type="button"
                      disabled={busy === conn.provider}
                      className="rounded-md border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold"
                      onClick={() => disconnect(conn.provider, conn.id!)}
                    >
                      Manage Connection
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy === conn.provider}
                    className="rounded-md bg-[var(--altus-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    onClick={() => connect(conn.provider)}
                  >
                    {busy === conn.provider ? "Connecting…" : "Connect"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

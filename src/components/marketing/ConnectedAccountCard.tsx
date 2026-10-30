"use client";

import { cn } from "@/lib/cn";

export type ConnectedAccountCardModel = {
  platform: string;
  label: string;
  subtitle: string;
  oauthProvider: string;
  status: string;
  accountName: string | null;
  authorizedAssets: string[];
  permissions: string[];
  lastSuccessfulSync: string | null;
  connectionId: string | null;
  mode: string;
  lastError: string | null;
  liveOauthConfigured: boolean;
  missingEnv: string[];
  organicPublishing: string;
  advertising: string;
  analytics: string;
  leadAttribution: string;
  setupNotes: string[];
  canConnect: boolean;
  canDisconnect: boolean;
  canReconnect: boolean;
};

function relativeTime(iso: string | null) {
  if (!iso) return "Never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} hr ago`;
  return new Date(iso).toLocaleString();
}

function statusTone(status: string) {
  if (status === "CONNECTED") return "bg-[var(--altus-soft)] text-[var(--altus-blue)]";
  if (status === "ERROR" || status === "EXPIRED") return "bg-red-50 text-red-700";
  if (status === "ACTION_REQUIRED" || status === "CONNECTING")
    return "bg-amber-50 text-amber-800";
  return "bg-[var(--altus-section)] text-[var(--altus-text-secondary)]";
}

type Props = {
  card: ConnectedAccountCardModel;
  busy: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onRetrySync: () => void;
};

export function ConnectedAccountCard({
  card,
  busy,
  onConnect,
  onDisconnect,
  onReconnect,
  onRetrySync,
}: Props) {
  const connected = card.status === "CONNECTED";

  return (
    <article className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--altus-soft)] text-xs font-bold uppercase tracking-wide text-[var(--altus-blue)]">
            {card.label.slice(0, 2)}
          </div>
          <h2 className="mt-3 text-lg font-bold text-[var(--altus-text)]">{card.label}</h2>
          <p className="text-xs text-[var(--altus-text-secondary)]">{card.subtitle}</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            statusTone(card.status),
          )}
        >
          {card.status.replaceAll("_", " ")}
        </span>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--altus-text-secondary)]">Account</dt>
          <dd className="max-w-[200px] text-right font-medium text-[var(--altus-text)]">
            {card.accountName ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--altus-text-secondary)]">Business assets</dt>
          <dd className="max-w-[200px] text-right text-xs font-medium text-[var(--altus-text)]">
            {card.authorizedAssets.length
              ? card.authorizedAssets.join(" · ")
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--altus-text-secondary)]">Permissions</dt>
          <dd className="max-w-[200px] text-right text-xs font-medium text-[var(--altus-text)]">
            {card.permissions.length ? card.permissions.join(" · ") : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--altus-text-secondary)]">Last successful sync</dt>
          <dd className="font-medium text-[var(--altus-text)]">
            {relativeTime(card.lastSuccessfulSync)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--altus-text-secondary)]">Mode</dt>
          <dd className="font-medium text-[var(--altus-text)]">{card.mode}</dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-wide text-[var(--altus-text-secondary)]">
        <div>Organic: {card.organicPublishing.replaceAll("_", " ")}</div>
        <div>Ads: {card.advertising.replaceAll("_", " ")}</div>
        <div>Analytics: {card.analytics.replaceAll("_", " ")}</div>
        <div>Attribution: {card.leadAttribution.replaceAll("_", " ")}</div>
      </div>

      {card.lastError ? (
        <p className="mt-3 text-xs text-red-600">{card.lastError}</p>
      ) : null}

      {!card.liveOauthConfigured ? (
        <p className="mt-3 text-xs text-[var(--altus-text-secondary)]">
          LIVE OAuth env not configured
          {card.missingEnv.length ? ` (${card.missingEnv.join(", ")})` : ""}.
          Simulation connect remains available while PROVIDER_MODE=SIMULATION.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {connected ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              onClick={onRetrySync}
            >
              Sync now
            </button>
            <button
              type="button"
              disabled={busy || !card.canReconnect}
              className="rounded-md border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              onClick={onReconnect}
            >
              Reconnect
            </button>
            <button
              type="button"
              disabled={busy || !card.canDisconnect}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
              onClick={onDisconnect}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy || !card.canConnect}
            className="rounded-md bg-[var(--altus-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            onClick={onConnect}
          >
            {busy ? "Working…" : "Connect Account"}
          </button>
        )}
      </div>
    </article>
  );
}

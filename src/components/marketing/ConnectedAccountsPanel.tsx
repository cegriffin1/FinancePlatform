"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ConnectedAccountCard,
  type ConnectedAccountCardModel,
} from "@/components/marketing/ConnectedAccountCard";

type FoundationModule = {
  key: string;
  title: string;
  description: string;
  href: string;
  status: string;
};

export function ConnectedAccountsPanel() {
  const [cards, setCards] = useState<ConnectedAccountCardModel[]>([]);
  const [foundation, setFoundation] = useState<FoundationModule[]>([]);
  const [mode, setMode] = useState("SIMULATION");
  const [safetyNote, setSafetyNote] = useState("");
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [oauthBanner, setOauthBanner] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/marketing/connected-accounts");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Unable to load connected accounts");
      return;
    }
    setError(null);
    setCards(json.platforms ?? []);
    setFoundation(json.foundation ?? []);
    setMode(json.mode ?? "SIMULATION");
    setSafetyNote(json.safety?.note ?? "");
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get("oauth");
    if (oauth === "connected") {
      setOauthBanner(`Connected ${params.get("platform") ?? "account"} successfully.`);
    } else if (oauth === "error") {
      setOauthBanner(
        `OAuth did not complete (${params.get("code") ?? "error"}). Tokens were not stored.`,
      );
    }
  }, [refresh]);

  async function runAction(
    platform: string,
    action: "connect" | "disconnect" | "reconnect" | "retry_sync",
    connectionId?: string | null,
  ) {
    setBusyPlatform(platform);
    setError(null);
    try {
      const res = await fetch("/api/marketing/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, platform, connectionId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Action failed");
      } else if (json.redirect === "external" || json.authorizeUrl) {
        // Hard stop: foundation must never navigate to provider OAuth.
        setError("Live provider authorization is disabled in this foundation.");
        return;
      }
      await refresh();
    } finally {
      setBusyPlatform(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/app/marketing"
            className="text-sm font-semibold text-[var(--altus-blue)]"
          >
            ← Marketing
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Connected Accounts
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
            Connect Facebook, Instagram, TikTok, and LinkedIn business accounts for
            Highwater campaigns operated through ALTUS. Tokens stay encrypted
            server-side. Provider mode: <strong>{mode}</strong>
          </p>
        </div>
      </div>

      {oauthBanner ? (
        <p className="rounded-[10px] border border-[var(--altus-border)] bg-[var(--altus-soft)] px-4 py-3 text-sm text-[var(--altus-text)]">
          {oauthBanner}
        </p>
      ) : null}

      <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
        SIMULATION ONLY — no live Meta / TikTok / LinkedIn authorization, posting, or ad spend.
      </p>

      {safetyNote ? (
        <p className="rounded-[10px] border border-[var(--altus-border)] bg-[var(--altus-soft)] px-4 py-3 text-sm text-[var(--altus-text)]">
          {safetyNote}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {cards.map((card) => (
          <ConnectedAccountCard
            key={card.platform}
            card={card}
            busy={busyPlatform === card.platform}
            onConnect={() => void runAction(card.platform, "connect")}
            onDisconnect={() =>
              void runAction(card.platform, "disconnect", card.connectionId)
            }
            onReconnect={() => void runAction(card.platform, "reconnect")}
            onRetrySync={() =>
              void runAction(card.platform, "retry_sync", card.connectionId)
            }
          />
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-[var(--altus-text)]">
          Marketing foundation
        </h2>
        <p className="text-sm text-[var(--altus-text-secondary)]">
          Modules below are prepared for rollout. Status labels are explicit —
          nothing is claimed live until provider APIs are connected and tested.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {foundation.map((mod) => (
            <Link
              key={mod.key}
              href={mod.href}
              className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-[var(--altus-text)]">{mod.title}</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                  {mod.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
                {mod.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import type { LeadPricingConfig } from "@/domain/types/lead-inventory";

type Buckets = Record<string, SimLead[]>;

const LABELS: Record<string, string> = {
  active: "Active leads",
  hot: "Hot",
  medium: "Medium",
  cold: "Cold",
  recycling_soon: "Recycling soon",
  expiring: "Expiring",
  recycling_review: "Recycling review",
  marketplace_eligible: "Marketplace eligible",
  marketplace: "Listed",
  sold: "Sold",
  suppressed: "Suppressed",
  not_eligible: "Not eligible for resale",
};

export default function LeadInventoryAdminPage() {
  const [buckets, setBuckets] = useState<Buckets>({});
  const [pricing, setPricing] = useState<LeadPricingConfig | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/marketplace?view=admin", {
      headers: { "x-altus-role": "admin" },
    });
    const json = await res.json();
    setBuckets(json.buckets ?? {});
    setPricing(json.pricing_config ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  async function act(action: string, leadId: string, extra: Record<string, unknown> = {}) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-altus-role": "admin",
      },
      body: JSON.stringify({ action, lead_id: leadId, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed");
      return;
    }
    setMessage(`${action} ok`);
    await load();
  }

  async function savePricing() {
    if (!pricing) return;
    const res = await fetch("/api/marketplace", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-altus-role": "admin",
      },
      body: JSON.stringify({ action: "update_pricing_config", config: pricing }),
    });
    if (!res.ok) {
      setError("Pricing save failed");
      return;
    }
    setMessage("Pricing configuration saved");
    await load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead Inventory</h1>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            Lifecycle, compliance gates, pricing configuration, and marketplace controls.
          </p>
        </div>
        <Link href="/marketplace" className="text-sm font-semibold text-[var(--altus-blue)]">
          Open marketplace →
        </Link>
        <Link href="/admin/lead-lifecycle" className="text-sm font-semibold text-[var(--altus-blue)]">
          Lifecycle settings →
        </Link>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(LABELS).map(([key, label]) => (
          <div
            key={key}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <div className="text-2xl font-bold text-[var(--altus-blue)]">
              {buckets[key]?.length ?? 0}
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label}
            </div>
          </div>
        ))}
      </div>

      {Object.entries(LABELS).map(([key, label]) => (
        <section key={key} className="space-y-2">
          <h2 className="text-sm font-bold tracking-[0.12em] text-[var(--altus-blue)]">
            {label.toUpperCase()}
          </h2>
          {(buckets[key] ?? []).length === 0 ? (
            <p className="rounded-[10px] border border-dashed border-[var(--altus-border)] bg-white p-3 text-sm text-[var(--altus-text-secondary)]">
              None
            </p>
          ) : (
            (buckets[key] ?? []).map((lead) => (
              <article
                key={lead.id}
                className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">
                      {lead.first_name} {lead.last_name} · {lead.state}
                    </div>
                    <div className="text-xs text-[var(--altus-text-secondary)]">
                      {lead.inventory_status} · Score{" "}
                      {lead.aging?.current_score ?? lead.score} (orig{" "}
                      {lead.aging?.original_score ?? "—"}) ·{" "}
                      {lead.compliance?.suppressed ? "SUPPRESSED" : "compliant-check"}
                    </div>
                    <div className="text-xs text-[var(--altus-text-secondary)]">
                      Sharing:{" "}
                      {lead.compliance?.data_sharing_permitted ? "permitted" : "blocked"} ·
                      Resale: {lead.compliance?.resale_permitted ? "permitted" : "blocked"} ·
                      Basis: {lead.compliance?.consent_basis ?? "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs font-semibold"
                      onClick={() =>
                        void act("extend", lead.id, {
                          days: 7,
                          reason: "Eligible business extension",
                        })
                      }
                    >
                      Extend 7d
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs font-semibold"
                      onClick={() => void act("release", lead.id)}
                    >
                      Release
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs font-semibold"
                      onClick={() => void act("list_marketplace", lead.id)}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs font-semibold"
                      onClick={() =>
                        void act("suppress", lead.id, { reason: "Do-not-contact" })
                      }
                    >
                      Suppress
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs font-semibold"
                      onClick={() => void act("revoke_sharing", lead.id)}
                    >
                      Revoke sharing
                    </button>
                    <Link
                      href={`/app/leads/${lead.id}`}
                      className="rounded border px-2 py-1 text-xs font-semibold"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      ))}

      {pricing ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <h2 className="text-lg font-bold">Administrative pricing configuration</h2>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            Configurable bands and multipliers — not permanent hardcoded meeting estimates.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {pricing.bands.map((band, idx) => (
              <label key={band.asset_tier} className="text-xs">
                <span className="font-semibold">{band.asset_tier} base (cents)</span>
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={band.base_cents}
                  onChange={(e) => {
                    const bands = [...pricing.bands];
                    bands[idx] = {
                      ...band,
                      base_cents: Number(e.target.value),
                    };
                    setPricing({ ...pricing, bands });
                  }}
                />
              </label>
            ))}
            <label className="text-xs">
              <span className="font-semibold">Setter verified bonus</span>
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1"
                value={pricing.setter_verified_bonus_cents}
                onChange={(e) =>
                  setPricing({
                    ...pricing,
                    setter_verified_bonus_cents: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-xs">
              <span className="font-semibold">Exclusivity multiplier</span>
              <input
                type="number"
                step="0.01"
                className="mt-1 w-full rounded border px-2 py-1"
                value={pricing.exclusivity_multiplier}
                onChange={(e) =>
                  setPricing({
                    ...pricing,
                    exclusivity_multiplier: Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void savePricing()}
            className="mt-4 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
          >
            Save pricing
          </button>
        </section>
      ) : null}
    </div>
  );
}

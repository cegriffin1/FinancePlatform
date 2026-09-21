"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketplaceListingPreview } from "@/domain/types/lead-inventory";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default function MarketplacePage() {
  const [listings, setListings] = useState<MarketplaceListingPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [state, setState] = useState("");
  const [assetTier, setAssetTier] = useState("");
  const [temperature, setTemperature] = useState("");
  const [objective, setObjective] = useState("");
  const [minScore, setMinScore] = useState("0");
  const [maxScore, setMaxScore] = useState("100");
  const [minAge, setMinAge] = useState("0");
  const [maxAge, setMaxAge] = useState("999");
  const [minPrice, setMinPrice] = useState("0");
  const [maxPrice, setMaxPrice] = useState("100000");

  async function load() {
    const params = new URLSearchParams({
      view: "marketplace",
      min_score: minScore,
      max_score: maxScore,
      min_age: minAge,
      max_age: maxAge,
      min_price: String(Number(minPrice) * 100),
      max_price: String(Number(maxPrice) * 100),
    });
    if (state) params.set("state", state);
    if (assetTier) params.set("asset_tier", assetTier);
    if (temperature) params.set("temperature", temperature);
    if (objective) params.set("objective", objective);
    params.set("lead_type", "ANNUITY_OPPORTUNITY");

    const res = await fetch(`/api/marketplace?${params.toString()}`);
    const json = await res.json();
    setListings(json.listings ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buyerOrgId = "20000000-0000-4000-8000-000000000004";

  async function purchase(leadId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const reserve = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reserve",
          lead_id: leadId,
          buyer_organization_id: buyerOrgId,
        }),
      });
      const reserveJson = await reserve.json();
      if (!reserve.ok) throw new Error(reserveJson.error ?? "Reserve failed");

      const buy = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "purchase",
          lead_id: leadId,
          reservation_id: reserveJson.reservation.id,
          buyer_organization_id: buyerOrgId,
          buyer_label: "Standard Agency TX Advisor",
        }),
      });
      const buyJson = await buy.json();
      if (!buy.ok) throw new Error(buyJson.error ?? "Purchase failed");
      setMessage(`Purchased — ownership expires ${buyJson.purchase.ownership_expires_at}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  }

  const states = useMemo(
    () => Array.from(new Set(listings.map((l) => l.state))).sort(),
    [listings],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lead Marketplace</h1>
        <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
          Recycled Opportunities — compliant inventory only. PII is withheld until
          purchase. Consent and sharing permissions gate every listing.
        </p>
      </div>

      <h2 className="text-lg font-bold tracking-tight">Recycled Opportunities</h2>

      <div className="grid gap-2 rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)] sm:grid-cols-2 lg:grid-cols-5">
        <Filter label="State" value={state} onChange={setState} options={["", ...states]} />
        <Filter
          label="Asset Tier"
          value={assetTier}
          onChange={setAssetTier}
          options={["", "GOLD", "DIAMOND", "BLACK", "BELOW_TARGET"]}
        />
        <Filter
          label="Temperature"
          value={temperature}
          onChange={setTemperature}
          options={["", "HOT", "MEDIUM", "COLD", "WARM", "VERY_HOT", "READY_NOW"]}
        />
        <Filter
          label="Primary Objective"
          value={objective}
          onChange={setObjective}
          options={["", "INCOME", "GROW", "PROTECT", "BALANCE", "LEGACY"]}
        />
        <div className="text-xs">
          <div className="font-semibold">Score range</div>
          <div className="mt-1 flex gap-1">
            <input
              className="w-full rounded border px-2 py-1"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
            <input
              className="w-full rounded border px-2 py-1"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xs">
          <div className="font-semibold">Lead age (days)</div>
          <div className="mt-1 flex gap-1">
            <input
              className="w-full rounded border px-2 py-1"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
            />
            <input
              className="w-full rounded border px-2 py-1"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
            />
          </div>
        </div>
        <div className="text-xs">
          <div className="font-semibold">Price ($)</div>
          <div className="mt-1 flex gap-1">
            <input
              className="w-full rounded border px-2 py-1"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <input
              className="w-full rounded border px-2 py-1"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white sm:col-span-2 lg:col-span-1"
        >
          Apply filters
        </button>
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

      <div className="grid gap-4 md:grid-cols-2">
        {listings.length === 0 ? (
          <p className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-6 text-sm text-[var(--altus-text-secondary)] md:col-span-2">
            No eligible listings. Released leads appear here only when consent and
            sharing permissions allow resale.
          </p>
        ) : (
          listings.map((listing) => (
            <article
              key={listing.lead_id}
              className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]"
            >
              <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
                {listing.title.replaceAll("_", " ")}
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <div>{listing.state}</div>
                <div>Age {listing.age_range ?? "—"}</div>
                <div>
                  {listing.asset_band ?? "—"}
                  {listing.asset_band ? " · Potentially Repositionable" : ""}
                </div>
                <div>
                  Original Opportunity Score: {listing.original_opportunity_score}
                </div>
                <div>
                  Current Temperature:{" "}
                  {listing.operational_temperature ?? listing.current_temperature}
                </div>
                <div>Original Source: {listing.original_channel ?? "—"}</div>
                <div>
                  Profile:{" "}
                  {listing.profile_completion_percentage != null
                    ? `${listing.profile_completion_percentage}% Complete`
                    : "—"}
                </div>
                <div>Previous Status: {listing.previous_status ?? "—"}</div>
                <div>
                  Last Meaningful Interaction:{" "}
                  {listing.days_since_meaningful_interaction ?? listing.lead_age_days}{" "}
                  Days Ago
                </div>
                <div className="text-xs text-[var(--altus-text-secondary)]">
                  {listing.setter_verified ? "Setter verified · " : ""}
                  Asset amounts shown as self-reported unless verification basis exists.
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div className="text-2xl font-bold text-[var(--altus-blue)]">
                  {money(listing.price_cents)}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
                    onClick={() =>
                      setMessage(
                        `Opportunity preview (pre-purchase): ${listing.state} · ${listing.asset_tier} · Score ${listing.original_opportunity_score} · No PII disclosed`,
                      )
                    }
                  >
                    View Opportunity
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void purchase(listing.lead_id)}
                    className="rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
                  >
                    Purchase
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="text-xs">
      <span className="font-semibold">{label}</span>
      <select
        className="mt-1 w-full rounded border border-[var(--altus-border)] px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o || "all"} value={o}>
            {o || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

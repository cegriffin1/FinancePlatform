"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import type { CreativeAsset } from "@/domain/types/social-integrations";

export default function CreativeLibraryPage() {
  const [creatives, setCreatives] = useState<CreativeAsset[]>([]);
  const [headline, setHeadline] = useState("Strengthen your business strategy");
  const [body, setBody] = useState(
    "A short conversation can uncover opportunities around growth, tax, and protection.",
  );
  const [cta, setCta] = useState("Learn More");

  async function refresh() {
    const res = await fetch("/api/integrations");
    const json = await res.json();
    setCreatives(json.creatives ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_creative",
        asset_type: "copy",
        headline,
        body,
        cta,
        destination_url: null,
      }),
    });
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/campaigns" className="text-sm font-semibold text-[var(--altus-blue)]">
          ← Campaigns
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Creative library
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Reusable headlines, copy, and CTAs for Meta, LinkedIn, and Google campaigns.
        </p>
      </div>

      <form
        onSubmit={(e) => void onSubmit(e)}
        className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]"
      >
        <h2 className="text-lg font-bold">New creative asset</h2>
        <div className="mt-4 grid gap-3">
          <label className="text-sm font-semibold">
            Headline
            <input
              className="mt-1 w-full rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm font-normal"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold">
            Body
            <textarea
              className="mt-1 w-full rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm font-normal"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className="text-sm font-semibold">
            CTA
            <input
              className="mt-1 w-full rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm font-normal"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-4 rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          Save asset
        </button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {creatives.map((asset) => (
          <article
            key={asset.id}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {asset.asset_type}
            </p>
            <h3 className="mt-1 font-bold text-[var(--altus-text)]">{asset.headline}</h3>
            <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">{asset.body}</p>
            <p className="mt-3 text-xs font-semibold text-[var(--altus-blue)]">{asset.cta}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

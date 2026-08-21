"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listCampaignTemplates,
  listDraftCampaigns,
} from "@/application/campaigns/campaignCatalog";
import type { GrowthCampaign } from "@/domain/types/campaign-engine";

export default function CampaignsPage() {
  const templates = listCampaignTemplates().slice(0, 4);
  const [drafts, setDrafts] = useState<GrowthCampaign[]>([]);

  useEffect(() => {
    setDrafts(listDraftCampaigns());
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Campaigns
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
            Launch subscriber campaigns or browse ALTUS templates. Platform
            distribution and live ad publishing arrive in later phases.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/app/campaigns/templates"
            className="rounded-md border border-[var(--altus-border)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--altus-text)]"
          >
            Template library
          </Link>
          <Link
            href="/app/campaigns/new"
            className="rounded-md bg-[var(--altus-blue)] px-3.5 py-2 text-sm font-semibold text-white"
          >
            Create campaign
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[var(--altus-text)]">Your campaigns</h2>
            <span className="text-xs text-[var(--altus-text-secondary)]">
              {drafts.length} in this browser session
            </span>
          </div>
          {drafts.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-[var(--altus-border)] bg-[var(--altus-section)] p-6 text-sm text-[var(--altus-text-secondary)]">
              No campaigns yet. Start from a template or create a new campaign.
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[var(--altus-border)] px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-[var(--altus-text)]">{campaign.name}</p>
                    <p className="text-xs text-[var(--altus-text-secondary)]">
                      {campaign.owner_type} · {campaign.strategy} ·{" "}
                      {campaign.channels.join(", ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--altus-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase text-[var(--altus-blue)]">
                    {campaign.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <h2 className="text-lg font-bold text-[var(--altus-text)]">Ownership models</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--altus-text-secondary)]">
            <li>
              <strong className="text-[var(--altus-text)]">ALTUS platform</strong> —
              central acquisition, scored, distributed to eligible subscribers.
            </li>
            <li>
              <strong className="text-[var(--altus-text)]">Subscriber</strong> —
              org-owned budget/branding; leads stay with the organization.
            </li>
          </ul>
          <Link
            href="/app/campaigns/new?owner=platform"
            className="mt-4 inline-flex text-sm font-semibold text-[var(--altus-blue)]"
          >
            New platform campaign →
          </Link>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--altus-text)]">Featured templates</h2>
          <Link href="/app/campaigns/templates" className="text-sm font-semibold text-[var(--altus-blue)]">
            View all →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => (
            <article
              key={template.id}
              className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]"
            >
              <p className="text-[11px] font-semibold tracking-wide text-[var(--altus-blue)]">
                {template.strategy}
              </p>
              <h3 className="mt-1 font-bold text-[var(--altus-text)]">{template.name}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--altus-text-secondary)]">
                {template.description}
              </p>
              <Link
                href={`/app/campaigns/new?template=${template.id}`}
                className="mt-4 inline-flex text-sm font-semibold text-[var(--altus-blue)]"
              >
                Use template →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SimCampaign } from "@/application/growth/simulationStore";

type StatePayload = {
  campaigns: SimCampaign[];
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<SimCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/campaigns/state", { cache: "no-store" });
    const json = (await res.json()) as StatePayload;
    setCampaigns(json.campaigns);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function setStatus(campaignId: string, status: string) {
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", campaignId, status }),
    });
    await refresh();
  }

  async function duplicate(campaignId: string) {
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "duplicate", campaignId }),
    });
    await refresh();
  }

  async function generateTestLead(campaignId: string) {
    await fetch("/api/dev/generate-test-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    window.location.href = "/app/leads";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Campaigns
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
            Create targeted campaigns, publish personalized lead experiences, and
            track every opportunity from first click through conversion.
          </p>
        </div>
        <Link
          href="/app/campaigns/new"
          className="rounded-md bg-[var(--altus-blue)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          + New Campaign
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--altus-text-secondary)]">Loading…</p>
      ) : campaigns.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-10 text-center shadow-[var(--altus-shadow)]">
          <h2 className="text-xl font-bold text-[var(--altus-text)]">
            Launch your first ALTUS campaign
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--altus-text-secondary)]">
            Create a targeted campaign, publish a personalized lead experience, and
            track every opportunity from first click through conversion.
          </p>
          <Link
            href="/app/campaigns/new"
            className="mt-6 inline-flex rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[12px] border border-[var(--altus-border)] bg-white shadow-[var(--altus-shadow)]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[var(--altus-border)] bg-[var(--altus-section)] text-[11px] uppercase tracking-wide text-[var(--altus-text-secondary)]">
              <tr>
                {[
                  "Campaign",
                  "Owner",
                  "Strategy",
                  "Territory",
                  "Channels",
                  "Status",
                  "Leads",
                  "Qualified",
                  "Appts",
                  "Conv.",
                  "Created",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-3 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => {
                const conv =
                  campaign.analytics.leads > 0
                    ? Math.round(
                        (campaign.analytics.appointments /
                          campaign.analytics.leads) *
                          100,
                      )
                    : 0;
                return (
                  <tr key={campaign.id} className="border-b border-[var(--altus-border)]">
                    <td className="px-3 py-3 font-semibold text-[var(--altus-text)]">
                      {campaign.name}
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {campaign.owner_type === "ALTUS_PLATFORM_CAMPAIGN"
                        ? "Platform"
                        : "Subscriber"}
                    </td>
                    <td className="px-3 py-3">{campaign.strategy}</td>
                    <td className="px-3 py-3">{campaign.territories.join(", ")}</td>
                    <td className="px-3 py-3">{campaign.channels.join(", ")}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--altus-blue)]">
                        {String(campaign.status).replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">{campaign.analytics.leads}</td>
                    <td className="px-3 py-3">{campaign.analytics.qualified_leads}</td>
                    <td className="px-3 py-3">{campaign.analytics.appointments}</td>
                    <td className="px-3 py-3">{conv}%</td>
                    <td className="px-3 py-3 text-xs">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          href={`/app/campaigns/${campaign.id}`}
                          className="text-xs font-semibold text-[var(--altus-blue)]"
                        >
                          View
                        </Link>
                        <Link
                          href={`/c/${campaign.organization_slug}/${campaign.slug}`}
                          className="text-xs font-semibold"
                        >
                          Public
                        </Link>
                        <button type="button" className="text-xs font-semibold" onClick={() => duplicate(campaign.id)}>
                          Duplicate
                        </button>
                        <button type="button" className="text-xs font-semibold" onClick={() => setStatus(campaign.id, "paused")}>
                          Pause
                        </button>
                        <button type="button" className="text-xs font-semibold" onClick={() => setStatus(campaign.id, "active_simulation")}>
                          Resume
                        </button>
                        <button type="button" className="text-xs font-semibold" onClick={() => setStatus(campaign.id, "archived")}>
                          Archive
                        </button>
                        {process.env.NODE_ENV !== "production" ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[var(--altus-blue)]"
                            onClick={() => generateTestLead(campaign.id)}
                          >
                            Test Lead
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

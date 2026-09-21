"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SimCampaign, SimLead } from "@/application/growth/simulationStore";
import { cn } from "@/lib/cn";
import {
  DEFAULT_LIFECYCLE_CONFIG,
  type OperationalTemperature,
} from "@/domain/types/lead-lifecycle";
import {
  NextBestActionService,
  SpeedToLeadService,
} from "@/application/crm/SpeedToLeadService";

type TempTab =
  | "ALL"
  | "HOT"
  | "MEDIUM"
  | "COLD"
  | "RECYCLING_SOON"
  | "UNASSIGNED";

type SortKey =
  | "priority"
  | "newest"
  | "score"
  | "assets"
  | "urgent"
  | "waiting"
  | "recycling";

type AttentionFilter =
  | null
  | "hot_need_contact"
  | "sla"
  | "appointments"
  | "recycling";

type BuiltInView =
  | "none"
  | "hot_need_contact"
  | "high_value"
  | "appointments_today"
  | "no_response"
  | "recycling_soon"
  | "unassigned";

function operationalOf(lead: SimLead): OperationalTemperature {
  if (lead.operational_temperature) return lead.operational_temperature;
  const key = lead.temperature_key;
  if (key === "COLD") return "COLD";
  if (key === "WARM" || key === "MEDIUM") return "MEDIUM";
  return "HOT";
}

function opportunityScore(lead: SimLead) {
  return (
    lead.aging?.original_score ??
    lead.qualification?.opportunity.opportunity_score ??
    lead.score
  );
}

function daysSinceMeaningful(lead: SimLead) {
  if (typeof lead.days_since_meaningful_interaction === "number") {
    return lead.days_since_meaningful_interaction;
  }
  const anchor = lead.last_meaningful_interaction_at ?? lead.created_at;
  return Math.floor(
    (Date.now() - new Date(anchor).getTime()) / (24 * 60 * 60 * 1000),
  );
}

function isRecyclingSoon(lead: SimLead) {
  const days = daysSinceMeaningful(lead);
  const coldAfter = DEFAULT_LIFECYCLE_CONFIG.cold_after_days;
  const recycleAfter = DEFAULT_LIFECYCLE_CONFIG.recycle_after_days;
  return (
    lead.inventory_status === "RECYCLING_REVIEW" ||
    lead.inventory_status === "AGING" ||
    (days >= coldAfter && days < recycleAfter)
  );
}

function isUnassigned(lead: SimLead) {
  return (
    lead.distribution_status === "unassigned_pool" ||
    lead.status === "unassigned_pool" ||
    Boolean(lead.routing_attention)
  );
}

function needsContact(lead: SimLead) {
  const speed = new SpeedToLeadService().refresh(lead);
  return (
    operationalOf(lead) === "HOT" &&
    speed.sla_state !== "COMPLETED" &&
    !lead.sla?.first_contact_attempt_at &&
    !(lead.contact_attempts?.length)
  );
}

function hasAppointmentToday(lead: SimLead) {
  const today = new Date().toDateString();
  return (lead.appointments ?? []).some((a) => {
    if (a.status === "cancelled") return false;
    return new Date(a.scheduled_at).toDateString() === today;
  });
}

function assetRank(lead: SimLead) {
  const band =
    lead.assessment_answers.repositionable_assets ??
    lead.qualification?.asset.repositionable_asset_band ??
    "";
  if (/\$1M|\$2M|\$5M/i.test(band)) return 5;
  if (/\$750K/i.test(band)) return 4;
  if (/\$500K/i.test(band)) return 3;
  if (/\$250K/i.test(band)) return 2;
  return 1;
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

const TAB_META: Record<
  Exclude<TempTab, "ALL" | "UNASSIGNED">,
  { label: string; icon: string }
> = {
  HOT: { label: "HOT", icon: "🔥" },
  MEDIUM: { label: "MEDIUM", icon: "●" },
  COLD: { label: "COLD", icon: "❄" },
  RECYCLING_SOON: { label: "RECYCLING SOON", icon: "↻" },
};

export default function LeadCommandCenterPage() {
  const [leads, setLeads] = useState<SimLead[]>([]);
  const [campaigns, setCampaigns] = useState<SimCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TempTab>("HOT");
  const [sort, setSort] = useState<SortKey>("priority");
  const [attention, setAttention] = useState<AttentionFilter>(null);
  const [view, setView] = useState<BuiltInView>("none");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tempParam = params.get("temperature");
    if (tempParam === "HOT" || tempParam === "MEDIUM" || tempParam === "COLD") {
      setTab(tempParam);
    }
    if (params.get("campaign")) setCampaignFilter(params.get("campaign")!);
    if (params.get("channel")) setChannelFilter(params.get("channel")!);
    if (params.get("view") === "unassigned") {
      setTab("UNASSIGNED");
      setView("unassigned");
    }
  }, []);

  useEffect(() => {
    void fetch("/api/campaigns/state")
      .then((r) => r.json())
      .then((json) => {
        setLeads(json.leads ?? []);
        setCampaigns(json.campaigns ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        document.getElementById("lead-search")?.focus();
      }
      if (e.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const counts = useMemo(() => {
    return {
      all: leads.length,
      hot: leads.filter((l) => operationalOf(l) === "HOT").length,
      medium: leads.filter((l) => operationalOf(l) === "MEDIUM").length,
      cold: leads.filter((l) => operationalOf(l) === "COLD").length,
      recycling: leads.filter(isRecyclingSoon).length,
      unassigned: leads.filter(isUnassigned).length,
    };
  }, [leads]);

  const attentionCounts = useMemo(() => {
    const speed = new SpeedToLeadService();
    return {
      hotNeedContact: leads.filter(needsContact).length,
      sla: leads.filter((l) => {
        const s = speed.refresh(l).sla_state;
        return s === "DUE_SOON" || s === "BREACHED";
      }).length,
      appointments: leads.filter(hasAppointmentToday).length,
      recycling: leads.filter(isRecyclingSoon).length,
    };
  }, [leads]);

  const filtered = useMemo(() => {
    let list = [...leads];

    if (campaignFilter) {
      list = list.filter((l) => l.campaign_id === campaignFilter);
    }
    if (channelFilter) {
      list = list.filter((l) => {
        const src = (
          l.attribution.ad_provider ??
          l.attribution.source ??
          ""
        ).toLowerCase();
        return src.includes(channelFilter.toLowerCase());
      });
    }

    if (attention === "hot_need_contact" || view === "hot_need_contact") {
      list = list.filter(needsContact);
    } else if (attention === "sla") {
      const speed = new SpeedToLeadService();
      list = list.filter((l) => {
        const s = speed.refresh(l).sla_state;
        return s === "DUE_SOON" || s === "BREACHED";
      });
    } else if (attention === "appointments" || view === "appointments_today") {
      list = list.filter(hasAppointmentToday);
    } else if (attention === "recycling" || view === "recycling_soon") {
      list = list.filter(isRecyclingSoon);
    } else if (view === "high_value") {
      list = list.filter((l) => opportunityScore(l) >= 80 && assetRank(l) >= 3);
    } else if (view === "no_response") {
      list = list.filter(
        (l) =>
          daysSinceMeaningful(l) >= 3 &&
          !(l.contact_attempts ?? []).some((c) =>
            (c.result ?? "").toLowerCase().includes("connected"),
          ),
      );
    } else if (view === "unassigned" || tab === "UNASSIGNED") {
      list = list.filter(isUnassigned);
    } else if (tab === "HOT") {
      list = list.filter((l) => operationalOf(l) === "HOT");
    } else if (tab === "MEDIUM") {
      list = list.filter((l) => operationalOf(l) === "MEDIUM");
    } else if (tab === "COLD") {
      list = list.filter((l) => operationalOf(l) === "COLD");
    } else if (tab === "RECYCLING_SOON") {
      list = list.filter(isRecyclingSoon);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.first_name.toLowerCase().includes(q) ||
          l.last_name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.business_name.toLowerCase().includes(q),
      );
    }

    const speed = new SpeedToLeadService();
    const tempRank = (t: OperationalTemperature) =>
      t === "HOT" ? 3 : t === "MEDIUM" ? 2 : 1;
    const slaRank = (l: SimLead) => {
      const s = speed.refresh(l).sla_state;
      if (s === "BREACHED") return 4;
      if (s === "DUE_SOON") return 3;
      if (s === "ON_TRACK") return 2;
      return 1;
    };

    list.sort((a, b) => {
      if (sort === "newest") {
        return b.created_at.localeCompare(a.created_at);
      }
      if (sort === "score") {
        return opportunityScore(b) - opportunityScore(a);
      }
      if (sort === "assets") {
        return assetRank(b) - assetRank(a);
      }
      if (sort === "urgent") {
        return slaRank(b) - slaRank(a);
      }
      if (sort === "waiting") {
        return daysSinceMeaningful(b) - daysSinceMeaningful(a);
      }
      if (sort === "recycling") {
        return (
          Number(isRecyclingSoon(b)) - Number(isRecyclingSoon(a)) ||
          daysSinceMeaningful(b) - daysSinceMeaningful(a)
        );
      }
      // priority default
      return (
        tempRank(operationalOf(b)) - tempRank(operationalOf(a)) ||
        slaRank(b) - slaRank(a) ||
        opportunityScore(b) - opportunityScore(a) ||
        daysSinceMeaningful(b) - daysSinceMeaningful(a)
      );
    });

    return list;
  }, [
    leads,
    tab,
    query,
    sort,
    attention,
    view,
    campaignFilter,
    channelFilter,
  ]);

  const campaignName = (id: string) =>
    campaigns.find((c) => c.id === id)?.name ?? "Campaign";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Lead Command Center
          </h1>
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            Prioritize opportunities, follow up quickly and move qualified
            prospects toward a conversation.
          </p>
        </div>
        <Link
          href="/app/campaigns/new"
          className="min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          + Create Campaign
        </Link>
      </div>

      {/* Needs attention */}
      <section>
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
          Needs attention
        </h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["hot_need_contact", "🔥", `${attentionCounts.hotNeedContact} Hot Leads Need Contact`],
              ["sla", "⏱", `${attentionCounts.sla} Leads Approaching SLA`],
              ["appointments", "📅", `${attentionCounts.appointments} Appointments Today`],
              ["recycling", "↻", `${attentionCounts.recycling} Leads Approaching Recycling`],
            ] as const
          ).map(([key, icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setAttention(attention === key ? null : key);
                setView("none");
                if (key === "hot_need_contact") setTab("HOT");
                if (key === "recycling") setTab("RECYCLING_SOON");
              }}
              className={cn(
                "rounded-[12px] border bg-white p-4 text-left shadow-[var(--altus-shadow)]",
                attention === key
                  ? "border-[var(--altus-blue)] ring-2 ring-[var(--altus-soft)]"
                  : "border-[var(--altus-border)]",
              )}
            >
              <span aria-hidden className="text-lg">
                {icon}
              </span>
              <div className="mt-1 text-sm font-semibold">{label}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Tabs */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ["ALL", counts.all, "ALL"],
            ["HOT", counts.hot, "🔥 HOT"],
            ["MEDIUM", counts.medium, "● MEDIUM"],
            ["COLD", counts.cold, "❄ COLD"],
            ["RECYCLING_SOON", counts.recycling, "↻ RECYCLING SOON"],
            ["UNASSIGNED", counts.unassigned, "UNASSIGNED"],
          ] as const
        ).map(([key, count, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setAttention(null);
              setView(key === "UNASSIGNED" ? "unassigned" : "none");
            }}
            className={cn(
              "min-h-11 rounded-[12px] border bg-white px-3 py-3 text-left shadow-[var(--altus-shadow)]",
              tab === key
                ? "border-[var(--altus-blue)] ring-2 ring-[var(--altus-soft)]"
                : "border-[var(--altus-border)]",
            )}
            aria-pressed={tab === key}
          >
            <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label}
            </div>
            <div className="text-2xl font-bold text-[var(--altus-blue)]">
              {count}
            </div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          id="lead-search"
          className="min-h-11 min-w-[220px] flex-1 rounded-[8px] border border-[var(--altus-border)] px-3 text-sm"
          placeholder="Search name, email, phone (/)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="min-h-11 rounded-[8px] border border-[var(--altus-border)] px-3 text-sm"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort leads"
        >
          <option value="priority">Most actionable</option>
          <option value="newest">Newest</option>
          <option value="score">Highest Opportunity Score</option>
          <option value="assets">Highest Assets</option>
          <option value="urgent">Most Urgent</option>
          <option value="waiting">Longest Waiting</option>
          <option value="recycling">Closest to Recycling</option>
        </select>
        <select
          className="min-h-11 rounded-[8px] border border-[var(--altus-border)] px-3 text-sm"
          value={view}
          onChange={(e) => {
            setView(e.target.value as BuiltInView);
            setAttention(null);
          }}
          aria-label="Saved views"
        >
          <option value="none">Views…</option>
          <option value="hot_need_contact">HOT — Need Contact</option>
          <option value="high_value">High Value</option>
          <option value="appointments_today">Appointments Today</option>
          <option value="no_response">No Response</option>
          <option value="recycling_soon">Recycling Soon</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <button
          type="button"
          className="min-h-11 rounded-[8px] border border-[var(--altus-border)] px-3 text-sm font-semibold"
          onClick={() => setFiltersOpen((o) => !o)}
        >
          Filters
        </button>
      </div>

      {filtersOpen ? (
        <div className="grid gap-3 rounded-[12px] border border-[var(--altus-border)] bg-white p-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Campaign
            <select
              className="mt-1 min-h-11 w-full rounded border px-2"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="">All campaigns</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Channel
            <select
              className="mt-1 min-h-11 w-full rounded border px-2"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
            >
              <option value="">All channels</option>
              <option value="linkedin">LinkedIn</option>
              <option value="meta">Meta</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-[12px] bg-[var(--altus-soft)]"
            />
          ))}
          <p className="text-sm text-[var(--altus-text-secondary)]">
            Loading leads…
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-8">
          <p className="font-bold text-[var(--altus-text)]">
            {tab === "HOT"
              ? "No hot leads need attention"
              : "No leads in this view"}
          </p>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            {tab === "HOT"
              ? "You're caught up."
              : "Qualified opportunities appear here as prospects complete the assessment."}
          </p>
          <Link
            href="/app/campaigns/new"
            className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--altus-blue)]"
          >
            Create Campaign →
          </Link>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[12px] border border-[var(--altus-border)] bg-white shadow-[var(--altus-shadow)] lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--altus-section)] text-[10px] uppercase tracking-wide text-[var(--altus-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-3 py-3">Temp</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Assets / Goal</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">SLA</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    campaignLabel={campaignName(lead.campaign_id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 lg:hidden">
            {filtered.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                campaignLabel={campaignName(lead.campaign_id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  campaignLabel,
}: {
  lead: SimLead;
  campaignLabel: string;
}) {
  const temp = operationalOf(lead);
  const speed = new SpeedToLeadService();
  const countdown = speed.formatCountdown(lead);
  const nba = new NextBestActionService().recommend(lead);
  const meta = TAB_META[temp];

  return (
    <tr className="border-t border-[var(--altus-border)]">
      <td className="px-4 py-3">
        <div className="font-bold">
          {lead.first_name} {lead.last_name.charAt(0)}.
        </div>
        <div className="text-xs text-[var(--altus-text-secondary)]">
          Last: {timeAgo(lead.last_meaningful_interaction_at ?? lead.created_at)}
        </div>
        {lead.routing_attention ? (
          <div className="mt-1 text-xs font-semibold text-amber-800">
            Routing: {lead.routing_attention}
          </div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
          {meta.icon} {temp}
        </span>
      </td>
      <td className="px-3 py-3 font-bold text-[var(--altus-blue)]">
        {opportunityScore(lead)}
      </td>
      <td className="px-3 py-3 text-xs">
        <div>
          {lead.assessment_answers.repositionable_assets ??
            lead.qualification?.asset.repositionable_asset_band ??
            "—"}
        </div>
        <div className="text-[var(--altus-text-secondary)]">
          {lead.assessment_answers.primary_objective ?? "—"} ·{" "}
          {lead.assessment_answers.decision_timeline ?? "—"}
        </div>
      </td>
      <td className="px-3 py-3 text-xs">
        <div>
          {lead.attribution.ad_provider ?? lead.attribution.source ?? "—"}
        </div>
        <div className="text-[var(--altus-text-secondary)]">{campaignLabel}</div>
      </td>
      <td className="px-3 py-3 text-xs">
        {lead.assigned_agent_label ?? lead.ownership?.owner_label ?? "Unassigned"}
      </td>
      <td className="px-3 py-3 text-xs font-semibold">
        <div>{countdown}</div>
        <div className="font-normal text-[var(--altus-text-secondary)]">
          {nba.headline}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/app/leads/${lead.id}`}
          className="min-h-11 inline-flex items-center rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
        >
          Open Lead
        </Link>
      </td>
    </tr>
  );
}

function LeadCard({
  lead,
  campaignLabel,
}: {
  lead: SimLead;
  campaignLabel: string;
}) {
  const temp = operationalOf(lead);
  const meta = TAB_META[temp];
  const countdown = new SpeedToLeadService().formatCountdown(lead);
  const nba = new NextBestActionService().recommend(lead);

  return (
    <article className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
            {meta.icon} {temp}
          </span>
          <h2 className="mt-2 text-xl font-bold">
            {lead.first_name} {lead.last_name.charAt(0)}.
          </h2>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[var(--altus-blue)]">
            {opportunityScore(lead)}
          </div>
          <div className="text-[10px] font-semibold uppercase text-[var(--altus-text-secondary)]">
            Opportunity Score
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm">
        {lead.assessment_answers.repositionable_assets ?? "Assets —"} Potentially
        Repositionable
      </p>
      <p className="text-sm text-[var(--altus-text-secondary)]">
        Goal: {lead.assessment_answers.primary_objective ?? "—"} · Decision:{" "}
        {lead.assessment_answers.decision_timeline ?? "—"}
      </p>
      <p className="mt-2 text-xs text-[var(--altus-text-secondary)]">
        Source: {lead.attribution.ad_provider ?? "—"} · {campaignLabel}
      </p>
      <p className="text-xs text-[var(--altus-text-secondary)]">
        Assigned:{" "}
        {lead.assigned_agent_label ?? lead.ownership?.owner_label ?? "Unassigned"}
      </p>
      <p className="text-xs text-[var(--altus-text-secondary)]">
        Last interaction:{" "}
        {timeAgo(lead.last_meaningful_interaction_at ?? lead.created_at)}
      </p>
      {lead.routing_attention ? (
        <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
          Routing attention: {lead.routing_attention}
        </p>
      ) : null}
      <p className="mt-3 text-sm font-bold">{countdown}</p>
      <p className="text-xs text-[var(--altus-text-secondary)]">{nba.headline}</p>
      <Link
        href={`/app/leads/${lead.id}`}
        className="mt-4 flex min-h-11 items-center justify-center rounded-md bg-[var(--altus-blue)] text-sm font-semibold text-white"
      >
        Open Lead
      </Link>
    </article>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import type { LeadEvent } from "@/domain/types";
import { actionLabel, nextStageAfterOutcome } from "@/application/intelligence/lifecycle";
import { LEAD_OUTCOMES } from "@/domain/types/lead-intelligence";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [lead, setLead] = useState<SimLead | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [brief, setBrief] = useState<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function load() {
    const { id } = await params;
    const res = await fetch("/api/leads/" + id);
    if (!res.ok) return;
    const detail = await res.json();
    setLead(detail.lead);
    setEvents(detail.events ?? []);
    setCampaignName(detail.campaignName ?? "");
    setOrgName(detail.organizationName ?? "");
    const intelEvent = (detail.events as LeadEvent[]).find(
      (e) => e.event_type === "lead_intelligence_ready",
    );
    if (intelEvent?.payload) {
      setBrief((intelEvent.payload as { brief?: Record<string, unknown> }).brief ?? null);
      setSummary((intelEvent.payload as { summary?: string }).summary ?? null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load when route id resolves
  }, [params]);

  async function markViewed() {
    if (!lead) return;
    await fetch(`/api/leads/${lead.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "viewed" }),
    });
    await load();
  }

  async function recordOutcome(outcome: string) {
    if (!lead) return;
    await fetch(`/api/leads/${lead.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "outcome",
        outcome,
        stage: nextStageAfterOutcome(outcome),
        closed_value_cents: outcome === "Won" ? 2500000 : null,
      }),
    });
    await load();
  }

  useEffect(() => {
    if (lead && !lead.sla?.first_viewed_at) {
      void markViewed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot view marker
  }, [lead?.id]);

  if (!lead) {
    return <p className="text-sm text-[var(--altus-text-secondary)]">Loading lead…</p>;
  }

  const intel = lead.intelligence;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/leads" className="text-sm font-semibold text-[var(--altus-blue)]">
            ← Lead Command Center
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
              {intel?.quality_grade ?? "—"} {lead.temperature_key}
            </span>
            <span className="text-xs text-[var(--altus-text-secondary)]">
              SLA {lead.sla?.sla_status ?? "pending"}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-[var(--altus-text)]">
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            {lead.business_name} · {lead.email} · {lead.phone}
          </p>
        </div>
        <div className="rounded-[12px] border border-[var(--altus-border)] bg-white px-5 py-4 text-center shadow-[var(--altus-shadow)]">
          <div className="text-3xl font-bold text-[var(--altus-blue)]">
            {lead.qualification?.opportunity.opportunity_score ??
              intel?.overall_priority_score ??
              lead.score}
          </div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
            Opportunity Score
          </div>
        </div>
      </div>

      {lead.qualification ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--altus-text-secondary)]">
            AGENT CARD
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div>
              <div className="text-3xl font-bold text-[var(--altus-blue)]">
                {lead.qualification.opportunity.opportunity_score} / 100
              </div>
              <div className="text-xs font-semibold uppercase text-[var(--altus-text-secondary)]">
                Opportunity Score · Grade {lead.qualification.lead_grade}
              </div>
            </div>
            <div>
              <div className="text-3xl font-bold">
                {lead.qualification.temperature.temperature_score}°{" "}
                <span className="text-lg">{lead.qualification.temperature.temperature.replace("_", " ")}</span>
              </div>
              <div className="text-xs font-semibold uppercase text-[var(--altus-text-secondary)]">
                Temperature
              </div>
            </div>
            {lead.qualification.asset.commercial_tier !== "BELOW_TARGET" ? (
              <div className="rounded-full border border-[var(--altus-border)] px-3 py-1 text-sm font-bold tracking-wide">
                {lead.qualification.asset.commercial_tier}
              </div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              {lead.qualification.asset.repositionable_asset_band ?? "—"} Potentially
              Repositionable
            </div>
            <div>
              {lead.assessment_answers.decision_timeline ?? lead.qualification.intent_label}
            </div>
            <div>
              Retiring {lead.assessment_answers.retirement_timing ?? "—"}
            </div>
            <div>
              {lead.assessment_answers.primary_objective ?? "—"}
              {lead.assessment_answers.advisor_improvement
                ? ` · Improve: ${lead.assessment_answers.advisor_improvement}`
                : ""}
            </div>
          </div>
          <div className="mt-4 grid gap-2 border-t border-[var(--altus-border)] pt-4 text-sm">
            <div>
              <span className="font-semibold">Profile:</span>{" "}
              {lead.qualification.completeness.answered_core_questions} of{" "}
              {lead.qualification.completeness.applicable_questions} applicable questions
              answered ({lead.qualification.completeness.profile_completion_percentage}%)
            </div>
            <div>
              <span className="font-semibold">Asset Status:</span>{" "}
              {lead.qualification.asset.verification_status === "SETTER_CONFIRMED"
                ? "Setter Confirmed"
                : "Self Reported"}
            </div>
            <div>
              <span className="font-semibold">Next Step:</span>{" "}
              {lead.qualification.recommended_next_step}
            </div>
            <div>
              <span className="font-semibold">Commercial Status:</span>{" "}
              {lead.qualification.commercial_status}
              {lead.qualification.agent_eligible ? " · Agent eligible" : " · Not agent-eligible yet"}
            </div>
          </div>
        </section>
      ) : null}

      {brief ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-[linear-gradient(145deg,#004C91,#0074C8)] p-5 text-white shadow-[var(--altus-shadow)]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/80">
            PRE-CALL BRIEF
          </p>
          <h2 className="mt-2 text-xl font-bold">{String(brief.who)}</h2>
          <p className="mt-1 text-sm text-white/90">{String(brief.business)}</p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>Primary: {String(brief.primary_need)}</div>
            <div>Secondary: {String(brief.secondary_need ?? "—")}</div>
            <div>Timeline: {String(brief.timeline)}</div>
            <div>Source: {String(brief.campaign_source)}</div>
          </div>
          <p className="mt-4 text-sm font-semibold">
            Next: {String(brief.recommended_next_action)}
          </p>
        </section>
      ) : null}

      {summary || intel?.explanation ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <h2 className="text-lg font-bold">Why this lead matters</h2>
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            {intel?.explanation}
          </p>
          {summary ? (
            <p className="mt-3 text-sm text-[var(--altus-text)]">{summary}</p>
          ) : null}
          <p className="mt-3 text-sm font-semibold text-[var(--altus-blue)]">
            Recommended action:{" "}
            {intel ? actionLabel(intel.recommended_action) : "—"}
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Intelligence">
          <Row label="Fit" value={String(intel?.fit_score ?? lead.fit_score)} />
          <Row label="Intent" value={String(intel?.intent_score ?? lead.intent_score)} />
          <Row label="Engagement" value={String(intel?.engagement_score ?? lead.engagement_score)} />
          <Row label="Data quality" value={String(intel?.data_quality_score ?? "—")} />
          <Row label="Contactability" value={String(intel?.contactability_score ?? "—")} />
          <Row label="Conversion" value={String(intel?.conversion_score ?? "—")} />
          <Row label="Value band" value={String(intel?.estimated_value_band ?? "—")} />
          <Row label="Model" value={String(intel?.conversion_model_label ?? "—")} />
        </Card>
        <Card title="Campaign source">
          <Row label="Campaign" value={campaignName || lead.campaign_id.slice(0, 8)} />
          <Row label="Source" value={lead.attribution.ad_provider ?? lead.attribution.source ?? "—"} />
          <Row label="External campaign" value={lead.attribution.external_campaign_id ?? "—"} />
          <Row label="UTM source" value={lead.attribution.utm_source ?? "—"} />
          <Row label="Quality gate" value={String(intel?.quality_gate ?? "—")} />
          <Row label="Identity" value={String(intel?.identity_result ?? "—")} />
        </Card>
        <Card title="Assignment">
          <Row label="Organization" value={orgName || lead.assigned_organization_id?.slice(0, 8) || "—"} />
          <Row label="Advisor" value={lead.assigned_agent_label ?? "—"} />
          <Row label="Stage" value={lead.pipeline_stage ?? "New"} />
          <Row label="Distribution" value={lead.distribution_status} />
        </Card>
      </div>

      <Card title="Score factors">
        <ul className="space-y-1 text-sm text-[var(--altus-text-secondary)]">
          {(intel?.factors ?? lead.score_breakdown.factors).map((f) => (
            <li key={f.key}>
              {f.points >= 0 ? "+" : ""}
              {f.points} {f.reason}
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Fast outcomes">
        <div className="flex flex-wrap gap-2">
          {LEAD_OUTCOMES.map((outcome) => (
            <button
              key={outcome}
              type="button"
              onClick={() => void recordOutcome(outcome)}
              className="rounded-full border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--altus-blue)] hover:text-[var(--altus-blue)]"
            >
              {outcome}
            </button>
          ))}
        </div>
        {lead.outcome ? (
          <p className="mt-3 text-sm">
            Current outcome: <strong>{lead.outcome}</strong>
            {lead.closed_value_cents != null
              ? ` · Closed $${(lead.closed_value_cents / 100).toLocaleString()}`
              : ""}
          </p>
        ) : null}
      </Card>

      <Card title="Event timeline">
        <ol className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="flex gap-3 text-sm">
              <span className="w-40 shrink-0 text-xs text-[var(--altus-text-secondary)]">
                {new Date(event.occurred_at).toLocaleString()}
              </span>
              <span className="font-medium text-[var(--altus-text)]">{event.event_type}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
      <h2 className="text-lg font-bold text-[var(--altus-text)]">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-[var(--altus-text-secondary)]">{label}</span>
      <span className="text-right font-medium text-[var(--altus-text)]">{value}</span>
    </div>
  );
}

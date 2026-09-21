"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import type { LeadEvent } from "@/domain/types";
import { actionLabel } from "@/application/intelligence/lifecycle";
import { PIPELINE_STAGES, type PipelineStage } from "@/domain/types/lead-intelligence";
import { AGENT_CRM_OUTCOMES } from "@/domain/types/retirement-crm";
import { buildPreCallBrief } from "@/application/crm/preCallBrief";
import {
  NextBestActionService,
  SpeedToLeadService,
} from "@/application/crm/SpeedToLeadService";

const FOLLOW_UP_RESULTS = [
  "Call Attempt",
  "Text",
  "Email",
  "Left Voicemail",
  "Connected",
  "No Answer",
  "Wrong Number",
  "Not Interested",
  "Call Back Later",
  "Appointment Scheduled",
] as const;

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [lead, setLead] = useState<SimLead | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [note, setNote] = useState("");
  const [callbackAt, setCallbackAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followResult, setFollowResult] = useState<string>("Connected");
  const [followNote, setFollowNote] = useState("");
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  async function load() {
    const { id } = await params;
    const res = await fetch("/api/leads/" + id);
    if (!res.ok) return;
    const detail = await res.json();
    setLead(detail.lead);
    setEvents(detail.events ?? []);
    setCampaignName(detail.campaignName ?? "");
    setOrgName(detail.organizationName ?? "");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (lead && !lead.sla?.first_viewed_at) {
      void fetch(`/api/leads/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "viewed" }),
      }).then(() => load());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  async function crm(action: string, extra: Record<string, unknown> = {}) {
    if (!lead) return;
    setBusy(true);
    try {
      await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lead_id: lead.id, ...extra }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!lead) {
    return <p className="text-sm text-[var(--altus-text-secondary)]">Loading lead…</p>;
  }

  const q = lead.qualification;
  const intel = lead.intelligence;
  const brief = buildPreCallBrief(lead);
  const nba = new NextBestActionService().recommend(lead);
  const speedLabel = new SpeedToLeadService().formatCountdown(lead);
  const temp =
    lead.operational_temperature ??
    q?.temperature.temperature ??
    lead.temperature_key;
  const score =
    q?.opportunity.opportunity_score ??
    lead.aging?.original_score ??
    lead.score;

  return (
    <div className="space-y-5 pb-24 sm:pb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/app/leads" className="text-sm font-semibold text-[var(--altus-blue)]">
            ← Lead Command Center
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge>{temp}</Badge>
            <Badge>{score} Opportunity Score</Badge>
            <Badge>
              {q?.asset.repositionable_asset_band ??
                lead.assessment_answers.repositionable_assets ??
                "Assets —"}
            </Badge>
            <Badge>
              {lead.assessment_answers.decision_timeline ?? "Timeline —"}
            </Badge>
            {lead.recycled ? <Badge>RECYCLED LEAD</Badge> : null}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {lead.first_name} {lead.last_name}
          </h1>
          <p className="text-sm text-[var(--altus-text-secondary)]">
            {lead.state} · {lead.phone} · {lead.email}
          </p>
          <p className="mt-1 text-xs font-semibold text-[var(--altus-text-secondary)]">
            {speedLabel}
          </p>
        </div>
      </div>

      {/* Mobile sticky quick actions */}
      <div className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto border-b border-[var(--altus-border)] bg-[var(--altus-bg,#f6f8fb)] px-4 py-2 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Action
          disabled={busy}
          href={`tel:${lead.phone}`}
          onClick={() =>
            void crm("contact_attempt", {
              channel: "call",
              result: "Call Attempt",
            })
          }
          label="Call"
        />
        <Action
          disabled={busy}
          href={`sms:${lead.phone}`}
          onClick={() =>
            void crm("contact_attempt", { channel: "sms", result: "Text" })
          }
          label="Text"
        />
        <Action
          disabled={busy}
          href={`mailto:${lead.email}`}
          onClick={() =>
            void crm("contact_attempt", { channel: "email", result: "Email" })
          }
          label="Email"
        />
        <button
          type="button"
          disabled={busy}
          className="shrink-0 rounded-md border border-[var(--altus-border)] bg-white px-3 py-2 text-xs font-semibold"
          onClick={() => setFollowUpOpen(true)}
        >
          Schedule
        </button>
        <button
          type="button"
          disabled={busy}
          className="shrink-0 rounded-md border border-[var(--altus-border)] bg-white px-3 py-2 text-xs font-semibold"
          onClick={() => {
            const body = window.prompt("Add note");
            if (body) void crm("add_note", { body });
          }}
        >
          Add Note
        </button>
      </div>
      <p className="text-[11px] text-[var(--altus-text-secondary)]">
        Call / Text / Email open your device apps. ALTUS records the attempt —
        messages are not auto-sent without a connected provider.
      </p>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
          Next best action
        </p>
        <p className="mt-2 text-xl font-bold text-[var(--altus-text)]">
          {nba.headline}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--altus-text-secondary)]">
          {nba.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
          onClick={() => setFollowUpOpen(true)}
        >
          Start Follow-Up
        </button>
      </section>

      {lead.routing_attention ? (
        <section className="rounded-[12px] border border-amber-300 bg-amber-50 p-4">
          <p className="text-[11px] font-bold uppercase text-amber-900">
            Routing attention required
          </p>
          <p className="mt-1 text-sm text-amber-950">{lead.routing_attention}</p>
          <p className="mt-2 text-xs">
            Assign manually via CRM ownership or setter handoff.
          </p>
        </section>
      ) : null}

      {followUpOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Follow-up panel"
        >
          <div className="w-full max-w-md rounded-t-[16px] bg-white p-5 shadow-xl sm:rounded-[16px]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Quick follow-up</h2>
              <button
                type="button"
                className="min-h-11 px-2 text-sm font-semibold"
                onClick={() => setFollowUpOpen(false)}
              >
                Close
              </button>
            </div>
            <label className="mt-3 block text-sm font-semibold">
              Disposition
              <select
                className="mt-1 min-h-11 w-full rounded border px-2"
                value={followResult}
                onChange={(e) => setFollowResult(e.target.value)}
              >
                {FOLLOW_UP_RESULTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Note
              <textarea
                className="mt-1 w-full rounded border px-2 py-2 text-sm"
                rows={3}
                value={followNote}
                onChange={(e) => setFollowNote(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm font-semibold">
              Next follow-up
              <input
                type="datetime-local"
                className="mt-1 min-h-11 w-full rounded border px-2"
                value={callbackAt}
                onChange={(e) => setCallbackAt(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={busy}
              className="mt-4 min-h-11 w-full rounded-md bg-[var(--altus-blue)] text-sm font-semibold text-white"
              onClick={async () => {
                const channel =
                  followResult === "Email"
                    ? "email"
                    : followResult === "Text"
                      ? "sms"
                      : "call";
                await crm("contact_attempt", {
                  channel,
                  result: followResult,
                });
                if (followNote) await crm("add_note", { body: followNote });
                if (callbackAt) {
                  await crm("create_follow_up", {
                    type: "Callback",
                    title: `Follow-up ${lead.first_name}`,
                    due_at: new Date(callbackAt).toISOString(),
                    body: followNote || null,
                  });
                }
                setFollowUpOpen(false);
                setFollowNote("");
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : null}

      {(() => {
        const days = lead.days_since_meaningful_interaction ??
          Math.floor(
            (Date.now() -
              new Date(
                lead.last_meaningful_interaction_at ?? lead.created_at,
              ).getTime()) /
              (24 * 60 * 60 * 1000),
          );
        const recycleAfter = 45;
        const remaining = Math.max(0, recycleAfter - days);
        const atRisk =
          (lead.operational_temperature === "COLD" || days >= 30) &&
          !lead.recycled &&
          lead.inventory_status !== "MARKETPLACE";
        if (!atRisk) return null;
        return (
          <section className="rounded-[12px] border border-amber-300 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-900">
              Lead at risk of recycling
            </p>
            <p className="mt-2 text-sm text-amber-950">
              No prospect interaction for {days} days. {remaining} days remaining
              before this lead becomes eligible for release.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Opening this record does not reset the inactivity clock — only
              meaningful prospect interaction does.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`tel:${lead.phone}`}
                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950"
              >
                Contact Lead
              </a>
              <button
                type="button"
                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950"
                onClick={() =>
                  void crm("create_follow_up", {
                    type: "Callback",
                    title: `Follow-up ${lead.first_name}`,
                    due_at: new Date(Date.now() + 3600000).toISOString(),
                  })
                }
              >
                Schedule Follow-Up
              </button>
              <a
                href="#temperature-history"
                className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950"
              >
                View History
              </a>
            </div>
          </section>
        );
      })()}

      {lead.recycled ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
            Recycled lead
          </p>
          <p className="mt-1 text-sm text-[var(--altus-text)]">
            This is not a fresh lead. Original Opportunity Score{" "}
            {lead.aging?.original_score ?? lead.score} is preserved. Current
            temperature: {lead.operational_temperature ?? lead.temperature_key}.
          </p>
          {lead.reengagement_plan ? (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase text-[var(--altus-text-secondary)]">
                Re-engagement plan (recommendations only)
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm">
                {lead.reengagement_plan.suggested_actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--altus-text-secondary)]">
                {lead.reengagement_plan.note}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {(lead.temperature_snapshots?.length ?? 0) > 0 ? (
        <section
          id="temperature-history"
          className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4"
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
            Temperature history
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {[...(lead.temperature_snapshots ?? [])]
              .slice()
              .reverse()
              .map((s) => (
                <li key={s.id} className="border-b border-[var(--altus-border)] pb-2">
                  <span className="font-semibold">{s.temperature}</span>
                  {" · "}
                  {new Date(s.calculated_at).toLocaleDateString()}
                  <div className="text-xs text-[var(--altus-text-secondary)]">
                    {s.reason} ({s.trigger})
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-[linear-gradient(145deg,#004C91,#0074C8)] p-4 text-white">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-white/80">
          PRE-CALL BRIEF
        </p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed">{brief}</pre>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
          Retirement opportunity
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm">
          <Row label="Age band" value={lead.assessment_answers.age_range ?? "—"} />
          <Row label="State" value={lead.state || lead.assessment_answers.state || "—"} />
          <Row label="Employment" value={lead.assessment_answers.employment ?? "—"} />
          <Row label="Retirement timeline" value={lead.assessment_answers.retirement_timing ?? "—"} />
          <Row label="Investable assets" value={lead.assessment_answers.total_retirement_assets ?? "—"} />
          <Row label="Potentially repositionable" value={lead.assessment_answers.repositionable_assets ?? "—"} />
          <Row label="Asset locations" value={lead.assessment_answers.asset_location ?? "—"} />
          <Row label="Existing annuity" value={lead.assessment_answers.existing_annuity ?? "—"} />
          <Row label="Liquidity timeline" value={lead.assessment_answers.liquidity_timeline ?? "—"} />
          <Row label="Primary objective" value={lead.assessment_answers.primary_objective ?? "—"} />
          <Row label="Decision timeline" value={lead.assessment_answers.decision_timeline ?? "—"} />
        </div>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-[var(--altus-blue)]"
          onClick={() => setAssessmentOpen((o) => !o)}
        >
          {assessmentOpen ? "Hide" : "View"} full assessment
        </button>
        {assessmentOpen ? (
          <div className="mt-3 space-y-2 border-t border-[var(--altus-border)] pt-3 text-sm">
            {Object.entries(lead.assessment_answers).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-[var(--altus-text-secondary)]">{k}</span>
                <span className="font-semibold text-right">{v}</span>
              </div>
            ))}
            <p className="text-xs text-[var(--altus-text-secondary)]">
              Self-reported unless setter verification status says otherwise.
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
          Acquisition
        </p>
        <div className="mt-2 space-y-2 text-sm">
          <div>
            Campaign:{" "}
            <Link
              href={`/app/campaigns/${lead.campaign_id}`}
              className="font-semibold text-[var(--altus-blue)]"
            >
              {campaignName || lead.campaign_id.slice(0, 8)}
            </Link>
          </div>
          <div>
            Channel:{" "}
            <span className="font-semibold">
              {lead.attribution.ad_provider ?? lead.attribution.source ?? "—"}
            </span>
          </div>
          <div>
            Creative:{" "}
            <span className="font-semibold">
              {lead.attribution.creative_id ??
                lead.attribution.utm_content ??
                "—"}
            </span>
          </div>
          <div>First touch: {lead.attribution.captured_at ?? lead.created_at}</div>
          <div>Assessment completed: {lead.scored_at ?? lead.created_at}</div>
          {lead.assignment_reason ? (
            <div>Assigned because: {lead.assignment_reason}</div>
          ) : null}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Opportunity">
          <Row label="Score" value={`${q?.opportunity.opportunity_score ?? lead.score}`} />
          <Row label="Grade" value={q?.lead_grade ?? intel?.quality_grade ?? "—"} />
          <Row label="Temperature" value={`${temp}`} />
          <Row label="Asset tier" value={q?.asset.commercial_tier ?? "—"} />
          <Row label="Assets" value={q?.asset.repositionable_asset_band ?? "—"} />
          <Row
            label="Asset status"
            value={
              q?.asset.verification_status === "SETTER_CONFIRMED"
                ? "Setter Confirmed"
                : "Self Reported"
            }
          />
        </Card>
        <Card title="Ownership">
          <Row label="Owner" value={lead.ownership?.owner_label ?? lead.assigned_agent_label ?? "—"} />
          <Row label="Organization" value={orgName || lead.ownership?.organization_id?.slice(0, 8) || "—"} />
          <Row
            label="Assigned"
            value={
              lead.ownership?.assigned_at
                ? new Date(lead.ownership.assigned_at).toLocaleDateString()
                : "—"
            }
          />
          <Row
            label="Expires"
            value={
              lead.ownership?.ownership_expires_at
                ? new Date(lead.ownership.ownership_expires_at).toLocaleDateString()
                : "—"
            }
          />
          <Row
            label="Period"
            value={lead.ownership ? `${lead.ownership.period_days} days` : "—"}
          />
          <Row
            label="Days remaining"
            value={
              lead.ownership?.ownership_expires_at
                ? `${Math.ceil(
                    (new Date(lead.ownership.ownership_expires_at).getTime() -
                      Date.now()) /
                      (24 * 60 * 60 * 1000),
                  )} Days Remaining`
                : "—"
            }
          />
          <Row label="Source" value={lead.ownership?.source ?? lead.attribution.source ?? "—"} />
          {lead.aging ? (
            <>
              <Row
                label="Original score"
                value={String(lead.aging.original_score)}
              />
              <Row
                label="Current score"
                value={String(lead.aging.current_score)}
              />
              <Row
                label="Original temp"
                value={lead.aging.original_temperature}
              />
              <Row
                label="Current temp"
                value={lead.aging.current_temperature}
              />
            </>
          ) : null}
          <div className="pt-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-[var(--altus-border)] px-2 py-1 text-xs font-semibold"
              onClick={() =>
                void fetch("/api/marketplace", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "extend",
                    lead_id: lead.id,
                    days: 7,
                    reason: "Agent-requested eligible extension",
                  }),
                }).then(() => load())
              }
            >
              Request 7-day extension
            </button>
          </div>
        </Card>
        <Card title="Campaign">
          <Row label="Campaign" value={campaignName || "—"} />
          <Row
            label="Source"
            value={lead.attribution.ad_provider ?? lead.attribution.source ?? "—"}
          />
          <Row label="UTM" value={lead.attribution.utm_source ?? "—"} />
          <Row label="External" value={lead.attribution.external_campaign_id ?? "—"} />
        </Card>
        <Card title="Status">
          <label className="block text-xs text-[var(--altus-text-secondary)]">
            Pipeline stage
            <select
              className="mt-1 w-full rounded-md border border-[var(--altus-border)] px-2 py-2 text-sm text-[var(--altus-text)]"
              value={lead.pipeline_stage ?? "NEW"}
              disabled={busy}
              onChange={(e) =>
                void crm("set_stage", { stage: e.target.value as PipelineStage })
              }
            >
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Row label="Outcome" value={lead.outcome ?? "—"} />
          <Row label="SLA" value={lead.sla?.sla_status ?? "—"} />
          <Row
            label="Setter"
            value={lead.setter_verification?.disposition ?? "—"}
          />
        </Card>
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Quick actions</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm"
              placeholder="Add note…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              disabled={busy || !note.trim()}
              className="mt-2 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
              onClick={() => {
                void crm("add_note", { body: note }).then(() => setNote(""));
              }}
            >
              Add Note
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="datetime-local"
              className="w-full rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm"
              value={callbackAt}
              onChange={(e) => setCallbackAt(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
              onClick={() =>
                void crm("create_follow_up", {
                  type: "Task",
                  title: `Follow up ${lead.first_name}`,
                  due_at: callbackAt
                    ? new Date(callbackAt).toISOString()
                    : new Date(Date.now() + 86400000).toISOString(),
                })
              }
            >
              Create Task
            </button>
            <button
              type="button"
              disabled={busy}
              className="ml-2 rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
              onClick={() =>
                void crm("create_follow_up", {
                  type: "Appointment",
                  title: `Appointment ${lead.first_name}`,
                  due_at: callbackAt
                    ? new Date(callbackAt).toISOString()
                    : new Date(Date.now() + 86400000).toISOString(),
                })
              }
            >
              Schedule
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Outcome</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {AGENT_CRM_OUTCOMES.map((outcome) => (
            <button
              key={outcome}
              type="button"
              disabled={busy}
              onClick={() => void crm("outcome", { outcome })}
              className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
            >
              {outcome}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">24-point profile</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(lead.assessment_answers).map(([k, v]) => (
            <div key={k} className="text-sm">
              <span className="font-semibold">{k.replaceAll("_", " ")}:</span> {v}
            </div>
          ))}
        </div>
        {q ? (
          <p className="mt-3 text-xs text-[var(--altus-text-secondary)]">
            Profile {q.completeness.answered_core_questions}/
            {q.completeness.applicable_questions} applicable (
            {q.completeness.profile_completion_percentage}%)
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card title="Notes">
          {(lead.crm_notes ?? []).length === 0 ? (
            <p className="text-sm text-[var(--altus-text-secondary)]">No notes yet</p>
          ) : (
            (lead.crm_notes ?? []).map((n) => (
              <div key={n.id} className="border-b border-[var(--altus-border)] py-2 text-sm">
                {n.body}
                <div className="text-[10px] text-[var(--altus-text-secondary)]">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </Card>
        <Card title="Tasks / Follow-ups">
          {(lead.follow_ups ?? []).filter((f) => f.type !== "Note").length === 0 ? (
            <p className="text-sm text-[var(--altus-text-secondary)]">None</p>
          ) : (
            (lead.follow_ups ?? [])
              .filter((f) => f.type !== "Note")
              .map((f) => (
                <div key={f.id} className="border-b border-[var(--altus-border)] py-2 text-sm">
                  <div className="font-semibold">
                    {f.type}: {f.title}
                  </div>
                  <div className="text-[10px] text-[var(--altus-text-secondary)]">
                    {f.status} · {f.due_at ? new Date(f.due_at).toLocaleString() : "—"}
                  </div>
                </div>
              ))
          )}
        </Card>
        <Card title="Contact attempts">
          {(lead.contact_attempts ?? []).length === 0 ? (
            <p className="text-sm text-[var(--altus-text-secondary)]">None</p>
          ) : (
            (lead.contact_attempts ?? []).map((c) => (
              <div key={c.id} className="border-b border-[var(--altus-border)] py-2 text-sm">
                {c.channel}
                <div className="text-[10px] text-[var(--altus-text-secondary)]">
                  {new Date(c.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {(lead.appointments ?? []).length > 0 ? (
        <Card title="Appointment">
          {lead.appointments!.map((a) => (
            <div key={a.id} className="text-sm">
              {new Date(a.scheduled_at).toLocaleString()} · {a.agent_name} ·{" "}
              {a.preferred_contact_method} · {a.status}
            </div>
          ))}
        </Card>
      ) : null}

      {intel?.explanation ? (
        <Card title="Why this lead matters">
          <p className="text-sm text-[var(--altus-text-secondary)]">{intel.explanation}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--altus-blue)]">
            Recommended: {actionLabel(intel.recommended_action)}
          </p>
        </Card>
      ) : null}

      <Card title="Timeline">
        <ul className="space-y-2 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex gap-3 border-b border-[var(--altus-border)] pb-2">
              <span className="w-40 shrink-0 text-xs text-[var(--altus-text-secondary)]">
                {new Date(e.occurred_at).toLocaleString()}
              </span>
              <span className="font-semibold">{e.event_type}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--altus-blue)]">
      {children}
    </span>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)]">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-2 space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-[var(--altus-text-secondary)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Action({
  label,
  href,
  onClick,
  disabled,
}: {
  label: string;
  href: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className={`shrink-0 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white ${disabled ? "opacity-60" : ""}`}
    >
      {label}
    </a>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SimLead } from "@/application/growth/simulationStore";
import type {
  AgentIntroductionProfile,
  EligibleAgent,
  FieldVerificationStatus,
  LeadAppointment,
  SetterDisposition,
  SetterVerificationFieldKey,
  SetterVerificationRecord,
} from "@/domain/types/setter-handoff";
import {
  FIELD_VERIFICATION_STATUSES,
  SETTER_DISPOSITIONS,
  DISPOSITIONS_REQUIRING_REASON,
} from "@/domain/types/setter-handoff";
import type { LeadEvent } from "@/domain/types";

const FIELD_LABELS: Record<SetterVerificationFieldKey, string> = {
  identity: "Identity",
  state: "State",
  contact: "Contact information",
  repositionable_assets: "Potentially repositionable assets",
  asset_location: "Asset location",
  primary_objective: "Primary objective",
  decision_timeline: "Decision timeline",
  appointment_interest: "Appointment interest",
};

type DetailPayload = {
  lead: SimLead;
  verification: SetterVerificationRecord;
  preCallBrief: string;
  campaignName: string | null;
  campaignSource: string | null;
  organizationName: string | null;
  agents: EligibleAgent[];
  introductions: AgentIntroductionProfile[];
  appointments: LeadAppointment[];
  events: LeadEvent[];
  fieldDefaults: Array<{
    field: SetterVerificationFieldKey;
    self_reported: string;
    verification: SetterVerificationRecord["fields"][number];
  }>;
};

export default function SetterLeadWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disposition, setDisposition] = useState<SetterDisposition>("VERIFIED");
  const [reason, setReason] = useState("");
  const [agentId, setAgentId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [contactMethod, setContactMethod] = useState("Phone");
  const [apptNotes, setApptNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { id } = await params;
    const res = await fetch(`/api/setter/leads/${id}`, {
      headers: { "x-altus-role": "setter" },
    });
    if (!res.ok) {
      setError("Unable to load lead");
      return;
    }
    const json = (await res.json()) as DetailPayload;
    setData(json);
    if (!agentId && json.agents[0]) setAgentId(json.agents[0].id);
    if (!scheduledAt) {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setMinutes(0, 0, 0);
      setScheduledAt(d.toISOString().slice(0, 16));
    }
    await fetch(`/api/setter/leads/${id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-altus-role": "setter",
      },
      body: JSON.stringify({ action: "open" }),
    });
  }, [params, agentId, scheduledAt]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
  }, [params]);

  async function post(body: Record<string, unknown>) {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/setter/leads/${data.lead.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-altus-role": "setter",
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Action failed");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const intro = useMemo(
    () => data?.introductions.find((i) => i.agent_id === agentId) ?? null,
    [data, agentId],
  );

  if (!data) {
    return (
      <p className="text-sm text-[var(--altus-text-secondary)]">
        {error ?? "Loading setter workspace…"}
      </p>
    );
  }

  const { lead, verification } = data;
  const q = lead.qualification;

  return (
    <div className="space-y-6">
      <Link href="/setter" className="text-sm font-semibold text-[var(--altus-blue)]">
        ← Setter Queue
      </Link>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric
          label="Lead Temperature"
          value={`${q?.temperature.temperature ?? lead.temperature_key}`}
          sub={`${q?.temperature.temperature_score ?? "—"}°`}
        />
        <Metric
          label="Opportunity Score"
          value={`${q?.opportunity.opportunity_score ?? lead.score}`}
          sub="/ 100"
        />
        <Metric
          label="Asset Tier"
          value={q?.asset.commercial_tier ?? "—"}
          sub={q?.asset.repositionable_asset_band ?? ""}
        />
        <Metric
          label="Campaign Source"
          value={data.campaignSource ?? "—"}
          sub={data.campaignName ?? ""}
        />
      </div>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-[linear-gradient(145deg,#004C91,#0074C8)] p-5 text-white shadow-[var(--altus-shadow)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-white/80">
          10-SECOND PRE-CALL BRIEF
        </p>
        <pre className="mt-3 whitespace-pre-wrap font-sans text-base leading-relaxed">
          {data.preCallBrief}
        </pre>
        <p className="mt-3 text-sm text-white/85">
          {lead.first_name} {lead.last_name} · {lead.phone} · {lead.email}
        </p>
      </section>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Verification Script</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void post({ action: "call_attempted" })}
            className="rounded-md border border-[var(--altus-border)] px-3 py-1.5 text-xs font-semibold"
          >
            Mark call attempted
          </button>
        </div>
        <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
          Original assessment answers are never changed. Store confirmation separately.
        </p>
        <div className="mt-4 space-y-3">
          {data.fieldDefaults.map((row) => (
            <div
              key={row.field}
              className="rounded-[10px] border border-[var(--altus-border)] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">
                    {FIELD_LABELS[row.field]}
                  </div>
                  <div className="mt-1 text-sm text-[var(--altus-text-secondary)]">
                    Self reported: {row.self_reported}
                  </div>
                  {row.verification.updated_value ? (
                    <div className="mt-1 text-sm text-[var(--altus-blue)]">
                      Setter update (separate): {row.verification.updated_value}
                    </div>
                  ) : null}
                </div>
                <select
                  className="rounded-md border border-[var(--altus-border)] px-2 py-1 text-xs"
                  value={row.verification.status}
                  disabled={busy}
                  onChange={(e) =>
                    void post({
                      action: "verify_field",
                      field: row.field,
                      status: e.target.value as FieldVerificationStatus,
                    })
                  }
                >
                  {FIELD_VERIFICATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void post({ action: "confirm_assets" })}
            className="rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
          >
            Confirm assets (SETTER CONFIRMED)
          </button>
          <span className="text-xs text-[var(--altus-text-secondary)]">
            Asset status: {verification.asset_verification_status} — not third-party
            verification
          </span>
        </div>
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Setter Disposition</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <select
            className="rounded-md border border-[var(--altus-border)] px-2 py-2 text-sm"
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as SetterDisposition)}
          >
            {SETTER_DISPOSITIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {DISPOSITIONS_REQUIRING_REASON.includes(disposition) ? (
            <input
              className="min-w-[220px] flex-1 rounded-md border border-[var(--altus-border)] px-3 py-2 text-sm"
              placeholder="Reason required"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void post({
                action: "disposition",
                disposition,
                reason: reason || null,
              })
            }
            className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
          >
            Save disposition
          </button>
        </div>
        {verification.disposition ? (
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            Current: {verification.disposition}
            {verification.disposition_reason
              ? ` — ${verification.disposition_reason}`
              : ""}
          </p>
        ) : null}
      </section>

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Appointment & Agent Handoff</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Eligible agent
            <select
              className="mt-1 w-full rounded-md border border-[var(--altus-border)] px-2 py-2"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Date / time
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-md border border-[var(--altus-border)] px-2 py-2"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <label className="text-sm">
            Preferred contact
            <select
              className="mt-1 w-full rounded-md border border-[var(--altus-border)] px-2 py-2"
              value={contactMethod}
              onChange={(e) => setContactMethod(e.target.value)}
            >
              <option>Phone</option>
              <option>Email</option>
              <option>Video</option>
            </select>
          </label>
          <label className="text-sm">
            Notes
            <input
              className="mt-1 w-full rounded-md border border-[var(--altus-border)] px-2 py-2"
              value={apptNotes}
              onChange={(e) => setApptNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !agentId || !scheduledAt}
            onClick={() =>
              void post({
                action: "schedule_appointment",
                agent_id: agentId,
                scheduled_at: new Date(scheduledAt).toISOString(),
                preferred_contact_method: contactMethod,
                notes: apptNotes || null,
              })
            }
            className="rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
          >
            Record appointment
          </button>
          <button
            type="button"
            disabled={busy || !agentId}
            onClick={() =>
              void post({
                action: "assign_agent",
                agent_id: agentId,
                appointment_id: data.appointments[0]?.id ?? null,
              })
            }
            className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold"
          >
            Assign agent & notify
          </button>
        </div>
        {data.appointments.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-[var(--altus-text-secondary)]">
            {data.appointments.map((a) => (
              <li key={a.id}>
                {a.scheduled_at} · {a.agent_name} · {a.status} ·{" "}
                {a.preferred_contact_method}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {intro ? (
        <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--altus-text-secondary)]">
            INTRODUCE THE ADVISOR
          </p>
          <h2 className="mt-2 text-lg font-bold">
            {intro.agent_name} · {intro.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
            {intro.organization_name} · Licenses: {intro.states_licenses.join(", ")}
          </p>
          <p className="mt-2 text-sm">{intro.experience_summary}</p>
          <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
            Specialties: {intro.specialties.join(", ")}
          </p>
          <blockquote className="mt-4 rounded-[10px] border border-[var(--altus-border)] bg-[var(--altus-soft)] p-4 text-sm leading-relaxed">
            {intro.approved_introduction_script}
          </blockquote>
        </section>
      ) : null}

      <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <h2 className="text-lg font-bold">Activity Timeline</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.events.map((e) => (
            <li key={e.id} className="flex gap-3 border-b border-[var(--altus-border)] pb-2">
              <span className="w-44 shrink-0 text-xs text-[var(--altus-text-secondary)]">
                {new Date(e.occurred_at).toLocaleString()}
              </span>
              <span className="font-semibold">{e.event_type}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-[var(--altus-text-secondary)]">
        Commercial status: {q?.commercial_status ?? "—"} · Agent:{" "}
        {lead.assigned_agent_label ?? "Unassigned"} ·{" "}
        <Link href={`/app/leads/${lead.id}`} className="font-semibold text-[var(--altus-blue)]">
          Open CRM profile
        </Link>
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--altus-border)] bg-white px-4 py-3 shadow-[var(--altus-shadow)]">
      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-[var(--altus-text)]">{value}</div>
      {sub ? (
        <div className="text-xs text-[var(--altus-text-secondary)]">{sub}</div>
      ) : null}
    </div>
  );
}

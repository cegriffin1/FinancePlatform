"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { RetirementAssessmentEngine } from "@/application/retirement/RetirementAssessmentEngine";
import { AltusMark } from "@/components/brand/AltusLogo";
import { cn } from "@/lib/cn";
import {
  PUBLIC_CONSENT_TEXT,
  PUBLIC_CONSENT_VERSION,
} from "@/domain/compliance/consent";

export type RetirementAssessmentProps = {
  organizationSlug: string;
  campaignSlug: string;
  thankYou: string;
  brandingName: string;
  trafficSource?: string;
  /** When true, renders inside homepage section (no full-page chrome). */
  embedded?: boolean;
};

type Phase =
  | "intro"
  | "bridge_money"
  | "questions"
  | "contact"
  | "analyzing"
  | "done";

type ConsumerProfile = {
  primary_goal: string | null;
  retirement_timeline: string | null;
  important_priorities: string[];
  planning_horizon: string | null;
  repositionable_band: string | null;
};

const engine = new RetirementAssessmentEngine();

function storageKey(org: string, campaign: string) {
  return `altus-assessment:${org}:${campaign}`;
}

function readAttribution(trafficSource?: string) {
  const params = new URLSearchParams(window.location.search);
  const isDirect = trafficSource === "DIRECT_ASSESSMENT";
  return {
    provider: isDirect
      ? "direct"
      : params.get("provider") || params.get("utm_source") || params.get("channel"),
    utm_source: isDirect ? "DIRECT_ASSESSMENT" : params.get("utm_source"),
    utm_medium: isDirect ? "direct" : params.get("utm_medium"),
    utm_campaign: isDirect ? "direct_assessment" : params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
    utm_term: params.get("utm_term"),
    external_campaign_id:
      params.get("campaign_id") || params.get("external_campaign_id"),
    external_ad_set_id: params.get("adset_id") || params.get("ad_set_id"),
    external_ad_id: params.get("ad_id"),
    external_creative_id:
      params.get("creative_id") || params.get("ad_creative_id"),
    referrer: document.referrer || null,
    source_channel: isDirect
      ? "DIRECT_ASSESSMENT"
      : params.get("channel") || params.get("utm_source") || "direct",
    landing_page: window.location.pathname,
    ad_provider: isDirect
      ? "direct"
      : params.get("provider") || params.get("utm_source"),
  };
}

export function RetirementAssessmentExperience(props: RetirementAssessmentProps) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt] = useState(() => new Date().toISOString());
  const [appointmentRequested, setAppointmentRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [restored, setRestored] = useState(false);
  const [sliderDraft, setSliderDraft] = useState("5");
  const [multiDraft, setMultiDraft] = useState<string[]>([]);
  const [stateQuery, setStateQuery] = useState("");
  const [moneyBridgeSeen, setMoneyBridgeSeen] = useState(false);
  const [profile, setProfile] = useState<ConsumerProfile | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const sessionInit = useRef(false);

  const current = engine.nextQuestion(answers);
  const stageMeta = engine.stageProgress(answers);

  useEffect(() => {
    if (sessionInit.current) return;
    sessionInit.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1") {
      try {
        sessionStorage.removeItem(
          storageKey(props.organizationSlug, props.campaignSlug),
        );
      } catch {
        // ignore
      }
    }

    void fetch("/api/public/assessment-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationSlug: props.organizationSlug,
        campaignSlug: props.campaignSlug,
        attribution: readAttribution(props.trafficSource),
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.sessionId) setSessionId(json.sessionId);
      })
      .catch(() => undefined);

    try {
      const raw = sessionStorage.getItem(
        storageKey(props.organizationSlug, props.campaignSlug),
      );
      if (!raw || params.get("reset") === "1") return;
      const parsed = JSON.parse(raw) as {
        answers?: Record<string, string>;
        phase?: Phase;
        sessionId?: string;
        history?: string[];
        moneyBridgeSeen?: boolean;
      };
      if (parsed.answers && Object.keys(parsed.answers).length > 0) {
        setAnswers(parsed.answers);
        setHistory(parsed.history ?? Object.keys(parsed.answers));
        setMoneyBridgeSeen(Boolean(parsed.moneyBridgeSeen));
        setPhase(
          parsed.phase === "contact"
            ? "contact"
            : parsed.phase === "questions" || parsed.phase === "bridge_money"
              ? "questions"
              : "intro",
        );
        if (parsed.sessionId) setSessionId(parsed.sessionId);
        setRestored(true);
      }
    } catch {
      // ignore
    }
  }, [props.organizationSlug, props.campaignSlug, props.trafficSource]);

  useEffect(() => {
    if (phase === "done" || phase === "intro" || phase === "analyzing") return;
    try {
      sessionStorage.setItem(
        storageKey(props.organizationSlug, props.campaignSlug),
        JSON.stringify({
          answers,
          phase,
          sessionId,
          history,
          moneyBridgeSeen,
        }),
      );
    } catch {
      // ignore
    }
  }, [
    answers,
    phase,
    sessionId,
    history,
    moneyBridgeSeen,
    props.organizationSlug,
    props.campaignSlug,
  ]);

  useEffect(() => {
    if (current?.type === "slider") {
      setSliderDraft(answers[current.id] || "5");
    }
    if (current?.type === "multi") {
      const existing = answers[current.id];
      setMultiDraft(existing ? existing.split("|").filter(Boolean) : []);
    }
    if (current?.id === "state") setStateQuery("");
  }, [current?.id, current?.type, answers]);

  // Stage bridge into YOUR MONEY
  useEffect(() => {
    if (phase !== "questions" || !current) return;
    if (current.stage === "YOUR_MONEY" && !moneyBridgeSeen) {
      setPhase("bridge_money");
    }
  }, [phase, current, moneyBridgeSeen]);

  async function patchSession(body: Record<string, unknown>) {
    if (!sessionId) return;
    try {
      await fetch("/api/public/assessment-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, ...body }),
      });
    } catch {
      // best-effort
    }
  }

  async function startAssessment() {
    setPhase("questions");
    await patchSession({ action: "start" });
    if (props.embedded) {
      document
        .getElementById("retirement-assessment")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function finalizeAnswer(questionId: string, value: string, stage: string) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    setHistory((h) => (h.includes(questionId) ? h : [...h, questionId]));
    const stageKey = stage as Parameters<typeof engine.isStageComplete>[0];
    const wasComplete = engine.isStageComplete(stageKey, answers);
    const nowComplete = engine.isStageComplete(stageKey, next);
    await patchSession({
      action: "answer",
      questionId,
      value,
      stage: !wasComplete && nowComplete ? stage : null,
    });
    const following = engine.nextQuestion(next);
    if (!following) {
      setPhase("contact");
      await patchSession({ action: "contact_started" });
    }
  }

  function goBack() {
    if (phase === "contact") {
      setPhase("questions");
      return;
    }
    if (phase === "bridge_money") {
      setPhase("questions");
      return;
    }
    const last = history[history.length - 1];
    if (!last) {
      setPhase("intro");
      return;
    }
    const nextHistory = history.slice(0, -1);
    const nextAnswers = { ...answers };
    delete nextAnswers[last];
    setHistory(nextHistory);
    setAnswers(nextAnswers);
  }

  async function submit(
    contact: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      state: string;
      preferredContact: string;
      consent: boolean;
    },
    requestAppointment: boolean,
  ) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationSlug: props.organizationSlug,
          campaignSlug: props.campaignSlug,
          answers,
          contact: {
            ...contact,
            businessName: `${contact.firstName} ${contact.lastName}`.trim(),
          },
          appointmentRequested: requestAppointment,
          attribution: readAttribution(props.trafficSource),
          sessionId,
          honeypot,
          submissionStartedAt: startedAt,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Submission failed");
      setProfile(json.consumerProfile ?? engine.consumerProfile(answers));
      setLeadId(json.leadId ?? null);
      setAppointmentRequested(requestAppointment);
      setPhase("analyzing");
      try {
        sessionStorage.removeItem(
          storageKey(props.organizationSlug, props.campaignSlug),
        );
      } catch {
        // ignore
      }
      window.setTimeout(() => setPhase("done"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  const progress = useMemo(() => {
    if (phase === "intro") return 4;
    if (phase === "bridge_money") return Math.max(8, stageMeta.percent);
    if (phase === "questions") return Math.max(8, stageMeta.percent);
    if (phase === "contact") return 92;
    if (phase === "analyzing") return 97;
    return 100;
  }, [phase, stageMeta.percent]);

  const stateOptions =
    current?.id === "state"
      ? current.display_options.filter((o) =>
          o.label.toLowerCase().includes(stateQuery.trim().toLowerCase()),
        )
      : current?.display_options ?? [];

  const shellClass = props.embedded
    ? "w-full"
    : "min-h-screen bg-[linear-gradient(180deg,#f4f7fb_0%,#eef3f9_40%,#f8fafc_100%)]";

  const mainClass = props.embedded
    ? "mx-auto max-w-[720px] px-0 py-2"
    : "mx-auto max-w-[720px] px-5 py-8 md:py-12";

  return (
    <div className={shellClass}>
      {!props.embedded ? (
        <header className="border-b border-[var(--altus-border)] bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-5">
            <div className="flex items-center gap-2">
              <AltusMark className="h-7 w-7" />
              <div className="text-sm font-semibold tracking-wide">
                {props.brandingName || "ALTUS"}
              </div>
            </div>
            <div className="text-xs font-semibold text-[var(--altus-text-secondary)]">
              ~2–4 min
            </div>
          </div>
        </header>
      ) : null}

      <div className={mainClass}>
        {phase !== "intro" && phase !== "done" && phase !== "analyzing" ? (
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
                {phase === "contact"
                  ? "CONTACT"
                  : phase === "bridge_money"
                    ? "YOUR MONEY"
                    : stageMeta.stage_label}
              </p>
              {(history.length > 0 || phase === "contact" || phase === "bridge_money") && (
                <button
                  type="button"
                  onClick={goBack}
                  className="text-xs font-semibold text-[var(--altus-text-secondary)] underline-offset-2 hover:underline"
                >
                  Back
                </button>
              )}
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-white shadow-inner"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Assessment progress"
            >
              <div
                className="h-full rounded-full bg-[var(--altus-blue)] transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {restored && phase !== "done" ? (
          <p className="mb-3 text-xs font-semibold text-[var(--altus-blue)]" role="status">
            Progress restored.{" "}
            <a
              className="underline"
              href={`${typeof window !== "undefined" ? window.location.pathname : ""}?reset=1`}
            >
              Start over
            </a>
          </p>
        ) : null}

        {phase === "intro" && (
          <section className="rounded-[18px] bg-[linear-gradient(145deg,#003d73,#0074C8)] p-8 text-white shadow-[var(--altus-shadow)] md:p-10">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-white/75">
              ALTUS
            </p>
            <p className="mt-3 text-[11px] font-bold tracking-[0.14em] text-white/85">
              RETIREMENT OPPORTUNITY ASSESSMENT
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              Build Your Retirement Profile
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90 md:text-base">
              Discover how your retirement goals, timeline and priorities fit
              together.
            </p>
            <p className="mt-3 text-sm font-semibold text-white/85">
              Takes approximately 2–4 minutes.
            </p>
            <button
              type="button"
              className="mt-8 min-h-12 rounded-md bg-white px-5 py-3 text-sm font-semibold text-[var(--altus-blue)] transition hover:bg-white/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              onClick={() => void startAssessment()}
            >
              Start Assessment
            </button>
            <p className="mt-5 text-xs font-medium tracking-wide text-white/70">
              Private · Secure · Personalized
            </p>
          </section>
        )}

        {phase === "bridge_money" && (
          <section className="rounded-[16px] border border-[var(--altus-border)] bg-white p-8 text-center shadow-[var(--altus-shadow)]">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
              YOUR MONEY
            </p>
            <h2 className="mt-3 text-2xl font-bold text-[var(--altus-text)]">
              Great — now let&apos;s look at the money you&apos;re preparing for
              retirement.
            </h2>
            <button
              type="button"
              className="mt-8 min-h-12 rounded-md bg-[var(--altus-blue)] px-5 py-3 text-sm font-semibold text-white"
              onClick={() => {
                setMoneyBridgeSeen(true);
                setPhase("questions");
              }}
            >
              Continue
            </button>
          </section>
        )}

        {phase === "questions" && current && (
          <section className="rounded-[16px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)] transition-all duration-300 md:p-8">
            {current.id === "primary_objective" ? (
              <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
                WHAT MATTERS MOST?
              </p>
            ) : null}
            <h2
              id="question-prompt"
              className="mt-2 text-xl font-bold leading-snug text-[var(--altus-text)] md:text-2xl"
            >
              {current.prompt}
            </h2>

            {current.type === "slider" ? (
              <div className="mt-8 space-y-5">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={sliderDraft}
                  aria-labelledby="question-prompt"
                  onChange={(e) => setSliderDraft(e.target.value)}
                  className="w-full accent-[var(--altus-blue)]"
                />
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--altus-text-secondary)]">
                  <span>1 — Low</span>
                  <span className="text-2xl font-bold text-[var(--altus-blue)]">
                    {sliderDraft}
                  </span>
                  <span>10 — High</span>
                </div>
                <button
                  type="button"
                  className="min-h-12 w-full rounded-md bg-[var(--altus-blue)] px-4 py-3 text-sm font-semibold text-white"
                  onClick={() =>
                    void finalizeAnswer(current.id, sliderDraft, current.stage)
                  }
                >
                  Continue
                </button>
              </div>
            ) : current.type === "multi" ? (
              <div className="mt-6 space-y-4">
                <div className="grid gap-2 sm:grid-cols-2" role="group" aria-labelledby="question-prompt">
                  {current.display_options.map((option) => {
                    const selected = multiDraft.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setMultiDraft((prev) =>
                            selected
                              ? prev.filter((v) => v !== option.value)
                              : [...prev, option.value],
                          );
                        }}
                        className={cn(
                          "min-h-12 rounded-[12px] border px-4 py-3 text-left text-sm font-semibold transition",
                          selected
                            ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                            : "border-[var(--altus-border)]",
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={multiDraft.length === 0}
                  className="min-h-12 w-full rounded-md bg-[var(--altus-blue)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() =>
                    void finalizeAnswer(
                      current.id,
                      multiDraft.join("|"),
                      current.stage,
                    )
                  }
                >
                  Continue
                </button>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {current.id === "state" ? (
                  <input
                    value={stateQuery}
                    onChange={(e) => setStateQuery(e.target.value)}
                    placeholder="Search state…"
                    aria-label="Search state"
                    className="min-h-11 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2 text-sm"
                  />
                ) : null}
                <div
                  className={cn(
                    "gap-2",
                    current.id === "state"
                      ? "grid max-h-72 grid-cols-6 overflow-y-auto sm:grid-cols-8"
                      : "space-y-2",
                  )}
                  role="radiogroup"
                  aria-labelledby="question-prompt"
                >
                  {stateOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={answers[current.id] === option.value}
                      onClick={() =>
                        void finalizeAnswer(current.id, option.value, current.stage)
                      }
                      className={cn(
                        "min-h-12 rounded-[12px] border px-4 py-3 text-left text-sm font-semibold transition hover:border-[var(--altus-blue)] hover:bg-[var(--altus-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--altus-blue)]",
                        current.id === "state" && "px-2 py-2.5 text-center text-xs",
                        current.id === "primary_objective" && "min-h-[4.5rem]",
                        answers[current.id] === option.value
                          ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                          : "border-[var(--altus-border)] bg-white",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
              Company website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </section>
        )}

        {phase === "contact" && (
          <ContactForm
            defaultState={answers.state ?? ""}
            error={error}
            submitting={submitting}
            onSubmit={submit}
          />
        )}

        {phase === "analyzing" && (
          <section className="rounded-[16px] border border-[var(--altus-border)] bg-white p-10 text-center shadow-[var(--altus-shadow)]">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
              ANALYZING PROFILE
            </p>
            <h2 className="mt-3 text-2xl font-bold text-[var(--altus-text)]">
              Building your Retirement Opportunity Profile…
            </h2>
            <p className="mt-3 text-sm text-[var(--altus-text-secondary)]">
              Reviewing your answers and preparing your personalized summary.
            </p>
            <div className="mx-auto mt-8 h-2 w-48 overflow-hidden rounded-full bg-[var(--altus-soft)]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[var(--altus-blue)]" />
            </div>
          </section>
        )}

        {phase === "done" && profile && (
          <section className="rounded-[16px] border border-[var(--altus-border)] bg-white p-8 shadow-[var(--altus-shadow)]">
            <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
              ASSESSMENT RESULT
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[var(--altus-text)]">
              Your Retirement Opportunity Profile is ready
            </h2>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-[var(--altus-text-secondary)]">
                  Primary Goal
                </dt>
                <dd className="mt-1 text-base font-bold">{profile.primary_goal ?? "—"}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--altus-text-secondary)]">
                  Retirement
                </dt>
                <dd className="mt-1 text-base font-bold">
                  {profile.retirement_timeline ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--altus-text-secondary)]">
                  Potentially Repositionable
                </dt>
                <dd className="mt-1 text-base font-bold">
                  {profile.repositionable_band ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--altus-text-secondary)]">
                  Important Priorities
                </dt>
                <dd className="mt-1 space-y-1">
                  {profile.important_priorities.length
                    ? profile.important_priorities.map((p) => <div key={p}>{p}</div>)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--altus-text-secondary)]">
                  Planning Timeline
                </dt>
                <dd className="mt-1 text-base font-bold">
                  {profile.planning_horizon ?? "—"}
                </dd>
              </div>
            </dl>
            {appointmentRequested ? (
              <p className="mt-6 text-sm font-semibold text-[var(--altus-blue)]">
                Conversation request received — a specialist will follow up.
              </p>
            ) : (
              <p className="mt-6 text-sm text-[var(--altus-text-secondary)]">
                {props.thankYou}
              </p>
            )}
            {leadId ? (
              <p className="mt-4 text-xs text-[var(--altus-text-secondary)]">
                Reference saved. Advisors can review this lead in{" "}
                <Link className="font-semibold text-[var(--altus-blue)]" href="/app/leads">
                  /app/leads
                </Link>
                .
              </p>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}

function ContactForm({
  onSubmit,
  submitting,
  error,
  defaultState,
}: {
  defaultState: string;
  onSubmit: (
    contact: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      state: string;
      preferredContact: string;
      consent: boolean;
    },
    appointmentRequested: boolean,
  ) => Promise<void>;
  submitting: boolean;
  error: string | null;
}) {
  const [wantAppointment, setWantAppointment] = useState(true);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await onSubmit(
      {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        state: String(form.get("state") ?? defaultState).toUpperCase(),
        preferredContact: String(form.get("preferredContact") ?? "Phone"),
        consent: form.get("consent") === "on",
      },
      wantAppointment,
    );
  }

  return (
    <form
      className="rounded-[16px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)] md:p-8"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
        YOUR RETIREMENT PROFILE IS READY
      </p>
      <h2 className="mt-2 text-xl font-bold text-[var(--altus-text)] md:text-2xl">
        Tell us where to send your personalized summary.
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {[
          ["firstName", "First name"],
          ["lastName", "Last name"],
          ["email", "Email"],
          ["phone", "Mobile phone"],
        ].map(([name, label]) => (
          <label key={name} className="block space-y-1 text-sm font-semibold">
            {label}
            <input
              required
              name={name}
              aria-required="true"
              className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
            />
          </label>
        ))}
        <label className="block space-y-1 text-sm font-semibold">
          State
          <input
            required
            name="state"
            defaultValue={defaultState}
            maxLength={2}
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal uppercase"
          />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          Preferred contact
          <select
            name="preferredContact"
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
          >
            <option>Phone</option>
            <option value="SMS">Text</option>
            <option>Email</option>
          </select>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm text-[var(--altus-text-secondary)]">
        <input required type="checkbox" name="consent" className="mt-1 h-5 w-5" />
        <span>
          {PUBLIC_CONSENT_TEXT}
          <span className="mt-1 block text-[10px] uppercase tracking-wide">
            Consent version {PUBLIC_CONSENT_VERSION}
          </span>
        </span>
      </label>
      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 rounded-md bg-[var(--altus-blue)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => setWantAppointment(true)}
        >
          Schedule My Retirement Conversation
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 rounded-md border border-[var(--altus-border)] px-4 py-3 text-sm font-semibold disabled:opacity-60"
          onClick={() => setWantAppointment(false)}
        >
          Send my summary
        </button>
      </div>
    </form>
  );
}

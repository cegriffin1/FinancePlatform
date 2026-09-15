"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AssessmentDecisionEngine } from "@/application/intelligence/assessmentDecision";
import { BUSINESS_GROWTH_ASSESSMENT_V1 } from "@/application/growth/assessmentTemplate";
import { AltusMark } from "@/components/brand/AltusLogo";
import { cn } from "@/lib/cn";
import {
  PUBLIC_CONSENT_TEXT,
  PUBLIC_CONSENT_VERSION,
} from "@/domain/compliance/consent";

type Props = {
  organizationSlug: string;
  campaignSlug: string;
  headline: string;
  support: string;
  cta: string;
  thankYou: string;
  strategy: string;
  brandingName: string;
};

const engine = new AssessmentDecisionEngine();

function storageKey(org: string, campaign: string) {
  return `altus-assessment:${org}:${campaign}`;
}

export function PublicCampaignExperience(props: Props) {
  const [phase, setPhase] = useState<"hero" | "questions" | "contact" | "done">(
    "hero",
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => new Date().toISOString());
  const [appointmentRequested, setAppointmentRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [restored, setRestored] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    temperature: string;
    strategies: string[];
  } | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(
        storageKey(props.organizationSlug, props.campaignSlug),
      );
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        answers?: Record<string, string>;
        phase?: "hero" | "questions" | "contact" | "done";
      };
      if (parsed.answers && Object.keys(parsed.answers).length > 0) {
        setAnswers(parsed.answers);
        setPhase(parsed.phase === "contact" ? "contact" : "questions");
        setRestored(true);
      }
    } catch {
      // ignore
    }
  }, [props.organizationSlug, props.campaignSlug]);

  useEffect(() => {
    if (phase === "done" || phase === "hero") return;
    try {
      sessionStorage.setItem(
        storageKey(props.organizationSlug, props.campaignSlug),
        JSON.stringify({ answers, phase }),
      );
    } catch {
      // ignore
    }
  }, [answers, phase, props.organizationSlug, props.campaignSlug]);

  const ordered = useMemo(() => engine.getOrderedQuestions(answers), [answers]);
  const current = engine.nextQuestion(answers);
  const answeredCount = Object.keys(answers).length;

  const progress = useMemo(() => {
    if (phase === "hero") return 0;
    if (phase === "questions") {
      const total = Math.max(ordered.length, answeredCount + 1);
      return Math.round(((answeredCount + 1) / total) * 70);
    }
    if (phase === "contact") return 85;
    return 100;
  }, [phase, ordered.length, answeredCount]);

  function attribution() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      referrer: document.referrer || null,
      source_channel: params.get("channel") || "direct",
      landing_page: window.location.pathname,
    };
  }

  async function submit(contact: {
    firstName: string;
    lastName: string;
    businessName: string;
    email: string;
    phone: string;
    state: string;
    preferredContact: string;
    consent: boolean;
  }, requestAppointment: boolean) {
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
          contact,
          appointmentRequested: requestAppointment,
          attribution: attribution(),
          honeypot,
          submissionStartedAt: startedAt,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Submission failed");
      setResult({
        score: json.score,
        temperature: json.temperature,
        strategies: json.strategies,
      });
      setAppointmentRequested(requestAppointment);
      setPhase("done");
      try {
        sessionStorage.removeItem(
          storageKey(props.organizationSlug, props.campaignSlug),
        );
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--altus-section)]">
      <header className="border-b border-[var(--altus-border)] bg-white">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-5">
          <div className="flex items-center gap-2">
            <AltusMark className="h-7 w-7" />
            <div>
              <div className="text-sm font-semibold tracking-wide">{props.brandingName}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--altus-text-secondary)]">
                {props.strategy}
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold text-[var(--altus-text-secondary)]">
            ~{BUSINESS_GROWTH_ASSESSMENT_V1.estimatedMinutes} min
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-5 py-8 md:py-12">
        <div
          className="mb-4 h-2 overflow-hidden rounded-full bg-white"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-label="Assessment progress"
        >
          <div className="h-full bg-[var(--altus-blue)] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        {restored ? (
          <p className="mb-3 text-xs font-semibold text-[var(--altus-blue)]" role="status">
            Progress restored from this device session.
          </p>
        ) : null}

        {phase === "hero" && (
          <section className="overflow-hidden rounded-[14px] bg-[linear-gradient(145deg,#004C91,#0074C8)] p-8 text-white shadow-[var(--altus-shadow)]">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/80">
              FREE · NO ACCOUNT REQUIRED
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              {props.headline}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/90">
              {props.support}
            </p>
            <button
              type="button"
              className="mt-6 min-h-11 rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-[var(--altus-blue)]"
              onClick={() => setPhase("questions")}
            >
              {props.cta}
            </button>
          </section>
        )}

        {phase === "questions" && current && (
          <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)]">
            <p className="text-xs font-semibold text-[var(--altus-text-secondary)]">
              Question {answeredCount + 1}
            </p>
            <h2 id="question-prompt" className="mt-2 text-xl font-bold text-[var(--altus-text)]">
              {current.prompt}
            </h2>
            <div className="mt-5 space-y-2" role="radiogroup" aria-labelledby="question-prompt">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={answers[current.key] === option}
                  onClick={() => {
                    const next = { ...answers, [current.key]: option };
                    setAnswers(next);
                    const following = engine.nextQuestion(next);
                    if (!following) setPhase("contact");
                  }}
                  className={cn(
                    "block min-h-11 w-full rounded-[10px] border px-4 py-3 text-left text-sm font-medium transition hover:border-[var(--altus-blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--altus-blue)]",
                    answers[current.key] === option
                      ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                      : "border-[var(--altus-border)]",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            {/* honeypot — visually hidden from users */}
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
            error={error}
            submitting={submitting}
            onSubmit={async (contact, requestAppt) => {
              await submit(contact, requestAppt);
            }}
          />
        )}

        {phase === "done" && result && (
          <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-8 text-center shadow-[var(--altus-shadow)]">
            <h2 className="text-2xl font-bold text-[var(--altus-text)]">You&apos;re all set</h2>
            <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">{props.thankYou}</p>
            {appointmentRequested ? (
              <p className="mt-3 text-sm font-semibold text-[var(--altus-blue)]">
                Strategy conversation request received.
              </p>
            ) : null}
            <p className="mt-6 text-xs text-[var(--altus-text-secondary)]">
              Reference temperature: {result.temperature} · Internal processing complete
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function ContactForm({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (
    contact: {
      firstName: string;
      lastName: string;
      businessName: string;
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
  const [wantAppointment, setWantAppointment] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await onSubmit(
      {
        firstName: String(form.get("firstName") ?? ""),
        lastName: String(form.get("lastName") ?? ""),
        businessName: String(form.get("businessName") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        state: String(form.get("state") ?? "").toUpperCase(),
        preferredContact: String(form.get("preferredContact") ?? "Email"),
        consent: form.get("consent") === "on",
      },
      wantAppointment,
    );
  }

  return (
    <form
      className="rounded-[12px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)]"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <h2 className="text-xl font-bold text-[var(--altus-text)]">How can we reach you?</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["firstName", "First name"],
          ["lastName", "Last name"],
          ["businessName", "Business name"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["state", "State (e.g. FL)"],
        ].map(([name, label]) => (
          <label key={name} className="block space-y-1 text-sm font-semibold">
            {label}
            <input
              required
              name={name}
              aria-required="true"
              className="min-h-11 w-full rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm font-normal"
            />
          </label>
        ))}
        <label className="block space-y-1 text-sm font-semibold sm:col-span-2">
          Preferred contact method
          <select name="preferredContact" className="w-full rounded-[8px] border border-[var(--altus-border)] px-3 py-2 text-sm font-normal">
            <option>Email</option>
            <option>Phone</option>
            <option>SMS</option>
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
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => setWantAppointment(true)}
        >
          Schedule My Strategy Conversation
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="min-h-11 rounded-md border border-[var(--altus-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          onClick={() => setWantAppointment(false)}
        >
          Submit without scheduling
        </button>
      </div>
    </form>
  );
}

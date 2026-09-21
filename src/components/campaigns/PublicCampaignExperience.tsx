"use client";

import { FormEvent, useState } from "react";
import { AssessmentDecisionEngine } from "@/application/intelligence/assessmentDecision";
import { BUSINESS_GROWTH_ASSESSMENT_V1 } from "@/application/growth/assessmentTemplate";
import { AltusMark } from "@/components/brand/AltusLogo";
import { RetirementAssessmentExperience } from "@/components/assessment/RetirementAssessmentExperience";
import { PUBLIC_CONSENT_TEXT } from "@/domain/compliance/consent";

type Props = {
  organizationSlug: string;
  campaignSlug: string;
  headline: string;
  support: string;
  cta: string;
  thankYou: string;
  strategy: string;
  brandingName: string;
  assessmentTemplateKey: string;
  trafficSource?: string;
  forceRetirement?: boolean;
};

const businessEngine = new AssessmentDecisionEngine();

export function PublicCampaignExperience(props: Props) {
  const isRetirement =
    props.forceRetirement ||
    props.assessmentTemplateKey.includes("retirement") ||
    props.strategy.toLowerCase().includes("retirement");

  if (isRetirement) {
    return (
      <RetirementAssessmentExperience
        organizationSlug={props.organizationSlug}
        campaignSlug={props.campaignSlug}
        thankYou={props.thankYou}
        brandingName={props.brandingName}
        trafficSource={props.trafficSource}
      />
    );
  }
  return <LegacyBusinessCampaignExperience {...props} />;
}

function readAttribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    provider: params.get("provider") || params.get("utm_source") || params.get("channel"),
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
    utm_term: params.get("utm_term"),
    referrer: document.referrer || null,
    source_channel: params.get("channel") || params.get("utm_source") || "direct",
    landing_page: window.location.pathname,
  };
}

function LegacyBusinessCampaignExperience(props: Props) {
  const [phase, setPhase] = useState<"intro" | "questions" | "contact" | "done">(
    "intro",
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt] = useState(() => new Date().toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const current = businessEngine.nextQuestion(answers);
  const answeredCount = Object.keys(answers).length;

  async function submit(
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
          contact,
          appointmentRequested: requestAppointment,
          attribution: readAttribution(),
          honeypot,
          submissionStartedAt: startedAt,
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Submission failed");
      setPhase("done");
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
            <div className="text-sm font-semibold">{props.brandingName}</div>
          </div>
          <div className="text-xs font-semibold text-[var(--altus-text-secondary)]">
            ~{BUSINESS_GROWTH_ASSESSMENT_V1.estimatedMinutes} min
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[720px] px-5 py-8">
        {phase === "intro" && (
          <section className="rounded-[14px] bg-[linear-gradient(145deg,#004C91,#0074C8)] p-8 text-white">
            <h1 className="text-3xl font-bold">{props.headline}</h1>
            <p className="mt-4 text-sm text-white/90">{props.support}</p>
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
          <section className="rounded-[12px] border border-[var(--altus-border)] bg-white p-6">
            <p className="text-xs font-semibold text-[var(--altus-text-secondary)]">
              Question {answeredCount + 1}
            </p>
            <h2 className="mt-2 text-xl font-bold">{current.prompt}</h2>
            <div className="mt-5 space-y-2" role="radiogroup">
              {current.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={answers[current.key] === option}
                  onClick={() => {
                    const next = { ...answers, [current.key]: option };
                    setAnswers(next);
                    if (!businessEngine.nextQuestion(next)) setPhase("contact");
                  }}
                  className="block min-h-11 w-full rounded-[10px] border border-[var(--altus-border)] px-4 py-3 text-left text-sm font-medium"
                >
                  {option}
                </button>
              ))}
            </div>
            <label className="absolute left-[-10000px] h-px w-px overflow-hidden">
              Company website
              <input
                tabIndex={-1}
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </label>
          </section>
        )}
        {phase === "contact" && (
          <ContactFormLegacy error={error} submitting={submitting} onSubmit={submit} />
        )}
        {phase === "done" && (
          <section className="rounded-[12px] border bg-white p-8 text-center">
            <h2 className="text-2xl font-bold">You&apos;re all set</h2>
            <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">{props.thankYou}</p>
          </section>
        )}
      </main>
    </div>
  );
}

function ContactFormLegacy({
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
      true,
    );
  }

  return (
    <form className="rounded-[12px] border bg-white p-6" onSubmit={(e) => void handleSubmit(e)}>
      <h2 className="text-xl font-bold">How can we reach you?</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["firstName", "First name"],
          ["lastName", "Last name"],
          ["businessName", "Business name"],
          ["email", "Email"],
          ["phone", "Phone"],
          ["state", "State"],
        ].map(([name, label]) => (
          <label key={name} className="block space-y-1 text-sm font-semibold">
            {label}
            <input
              required
              name={name}
              className="min-h-11 w-full rounded-[8px] border px-3 py-2 text-sm font-normal"
            />
          </label>
        ))}
        <label className="block space-y-1 text-sm font-semibold sm:col-span-2">
          Preferred contact
          <select name="preferredContact" className="w-full rounded-[8px] border px-3 py-2 text-sm">
            <option>Email</option>
            <option>Phone</option>
            <option>SMS</option>
          </select>
        </label>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input required type="checkbox" name="consent" className="mt-1 h-5 w-5" />
        <span>{PUBLIC_CONSENT_TEXT}</span>
      </label>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-5 min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        Submit
      </button>
    </form>
  );
}

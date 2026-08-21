"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BUILDER_STEPS,
  CAMPAIGN_CHANNELS,
  CAMPAIGN_DESTINATIONS,
  CAMPAIGN_GOALS,
  CAMPAIGN_STRATEGIES,
  type BuilderStep,
  type CampaignChannelKey,
  type CampaignDraftInput,
  type CampaignGoal,
  type CampaignOwnerType,
  type CampaignStrategyKey,
} from "@/domain/types/campaign-engine";
import {
  createCampaignFromDraft,
  getCampaignTemplate,
  launchCampaign,
} from "@/application/campaigns/campaignCatalog";
import { cn } from "@/lib/cn";

const STEP_LABELS: Record<BuilderStep, string> = {
  goal: "Goal",
  audience: "Audience",
  strategy: "Strategy",
  territory: "Territory",
  channels: "Channels",
  budget: "Budget",
  lead_experience: "Lead Experience",
  distribution: "Distribution",
  review: "Review",
  launch: "Launch",
};

const US_STATES = ["FL", "TX", "CA", "NY", "GA", "IL", "NC", "OH", "PA", "AZ"];

type Props = {
  templateId?: string;
  ownerType?: CampaignOwnerType;
};

export function CampaignBuilder({
  templateId,
  ownerType = "SUBSCRIBER_CAMPAIGN",
}: Props) {
  const template = templateId ? getCampaignTemplate(templateId) : null;
  const [stepIndex, setStepIndex] = useState(0);
  const [launchedId, setLaunchedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CampaignDraftInput>({
    owner_type: ownerType,
    owner_id: "00000000-0000-4000-8000-000000000099",
    organization_id:
      ownerType === "SUBSCRIBER_CAMPAIGN"
        ? "00000000-0000-4000-8000-000000000099"
        : null,
    name: template?.name ?? "Untitled Campaign",
    description: template?.description ?? "",
    goal: template?.goal ?? "generate_leads",
    strategy: template?.strategy ?? "Business Growth",
    audience: {
      personas: ["business_owner"],
      relationship: "prospect",
      company_size: "25-100",
      revenue_range: "$5M-$25M",
    },
    territories: ["FL"],
    channels: template?.default_channels ?? ["meta"],
    destination: template?.default_destination ?? "interactive_assessment",
    budget_cents: 250000,
    template_id: template?.id ?? null,
    branding: {
      organization_name: "Demo Organization",
      primary_color: "#0068B5",
      custom_cta: "Start Assessment",
      thank_you_message: "Thanks — an advisor will follow up shortly.",
    },
    qualification_template_key:
      template?.qualification_template_key ??
      "advanced_markets.stage1.engagement",
    distribution_config:
      ownerType === "ALTUS_PLATFORM_CAMPAIGN"
        ? { method: "priority_tier", preferPremierForPriority: true }
        : { method: "campaign_owner" },
  });

  const step = BUILDER_STEPS[stepIndex]!;
  const progress = useMemo(
    () => Math.round(((stepIndex + 1) / BUILDER_STEPS.length) * 100),
    [stepIndex],
  );

  function toggleChannel(channel: CampaignChannelKey) {
    setDraft((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  }

  function toggleTerritory(code: string) {
    setDraft((prev) => ({
      ...prev,
      territories: prev.territories.includes(code)
        ? prev.territories.filter((t) => t !== code)
        : [...prev.territories, code],
    }));
  }

  function saveDraft() {
    const campaign = createCampaignFromDraft(draft);
    return campaign;
  }

  function handleLaunch() {
    const campaign = saveDraft();
    const launched = launchCampaign(campaign.id);
    setLaunchedId(launched?.id ?? campaign.id);
    setStepIndex(BUILDER_STEPS.length - 1);
  }

  if (launchedId) {
    return (
      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-8 shadow-[var(--altus-shadow)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--altus-blue)]">
          CAMPAIGN LAUNCHED
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--altus-text)]">
          {draft.name} is active
        </h2>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Channel publishing uses mocked providers in Phase 1. Live Meta /
          LinkedIn / Google / TikTok connections land in a later phase.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/app/campaigns"
            className="rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Campaigns
          </Link>
          <Link
            href="/app/campaigns/templates"
            className="rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold text-[var(--altus-text)]"
          >
            Browse Templates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--altus-text-secondary)]">
              CAMPAIGN BUILDER · {ownerType === "ALTUS_PLATFORM_CAMPAIGN" ? "Platform" : "Subscriber"}
            </p>
            <h1 className="mt-1 text-xl font-bold text-[var(--altus-text)]">
              {draft.name}
            </h1>
          </div>
          <p className="text-sm font-semibold text-[var(--altus-blue)]">
            Step {stepIndex + 1} of {BUILDER_STEPS.length} · {STEP_LABELS[step]}
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--altus-soft)]">
          <div
            className="h-full rounded-full bg-[var(--altus-blue)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {BUILDER_STEPS.map((key, index) => (
            <button
              key={key}
              type="button"
              onClick={() => setStepIndex(index)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                index === stepIndex
                  ? "bg-[var(--altus-blue)] text-white"
                  : index < stepIndex
                    ? "bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                    : "bg-[var(--altus-section)] text-[var(--altus-text-secondary)]",
              )}
            >
              {STEP_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)]">
        {step === "goal" && (
          <div className="space-y-4">
            <Field label="Campaign name">
              <input
                className={inputClass}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                className={inputClass}
                rows={3}
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </Field>
            <Field label="Goal">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CAMPAIGN_GOALS.map((goal) => (
                  <Choice
                    key={goal}
                    selected={draft.goal === goal}
                    onClick={() => setDraft({ ...draft, goal: goal as CampaignGoal })}
                    label={goal.replaceAll("_", " ")}
                  />
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === "audience" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company size">
              <input
                className={inputClass}
                value={draft.audience.company_size ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    audience: { ...draft.audience, company_size: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Revenue range">
              <input
                className={inputClass}
                value={draft.audience.revenue_range ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    audience: { ...draft.audience, revenue_range: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Industry">
              <input
                className={inputClass}
                value={draft.audience.industry ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    audience: { ...draft.audience, industry: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Relationship">
              <select
                className={inputClass}
                value={draft.audience.relationship ?? "prospect"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    audience: {
                      ...draft.audience,
                      relationship: e.target.value as "prospect" | "existing_customer" | "any",
                    },
                  })
                }
              >
                <option value="prospect">Prospect</option>
                <option value="existing_customer">Existing customer</option>
                <option value="any">Any</option>
              </select>
            </Field>
          </div>
        )}

        {step === "strategy" && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPAIGN_STRATEGIES.map((strategy) => (
              <Choice
                key={strategy}
                selected={draft.strategy === strategy}
                onClick={() =>
                  setDraft({ ...draft, strategy: strategy as CampaignStrategyKey })
                }
                label={strategy}
              />
            ))}
          </div>
        )}

        {step === "territory" && (
          <div className="flex flex-wrap gap-2">
            {US_STATES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => toggleTerritory(code)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold",
                  draft.territories.includes(code)
                    ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                    : "border-[var(--altus-border)] text-[var(--altus-text-secondary)]",
                )}
              >
                {code}
              </button>
            ))}
          </div>
        )}

        {step === "channels" && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CAMPAIGN_CHANNELS.map((channel) => (
              <Choice
                key={channel}
                selected={draft.channels.includes(channel)}
                onClick={() => toggleChannel(channel)}
                label={channel.toUpperCase()}
              />
            ))}
          </div>
        )}

        {step === "budget" && (
          <Field label="Budget (USD)">
            <input
              type="number"
              className={inputClass}
              value={(draft.budget_cents ?? 0) / 100}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  budget_cents: Math.round(Number(e.target.value || 0) * 100),
                })
              }
            />
          </Field>
        )}

        {step === "lead_experience" && (
          <div className="space-y-4">
            <Field label="Destination">
              <div className="grid gap-2 sm:grid-cols-2">
                {CAMPAIGN_DESTINATIONS.map((destination) => (
                  <Choice
                    key={destination}
                    selected={draft.destination === destination}
                    onClick={() => setDraft({ ...draft, destination })}
                    label={destination.replaceAll("_", " ")}
                  />
                ))}
              </div>
            </Field>
            <Field label="Custom CTA">
              <input
                className={inputClass}
                value={draft.branding.custom_cta ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    branding: { ...draft.branding, custom_cta: e.target.value },
                  })
                }
              />
            </Field>
            <Field label="Thank-you message">
              <textarea
                className={inputClass}
                rows={3}
                value={draft.branding.thank_you_message ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    branding: {
                      ...draft.branding,
                      thank_you_message: e.target.value,
                    },
                  })
                }
              />
            </Field>
          </div>
        )}

        {step === "distribution" && (
          <div className="space-y-3 text-sm text-[var(--altus-text-secondary)]">
            {ownerType === "ALTUS_PLATFORM_CAMPAIGN" ? (
              <>
                <p>
                  Platform leads enter the ALTUS distribution pool, then route to
                  eligible subscribers using territory, licensing, strategy, capacity,
                  and Premier priority rules.
                </p>
                <p className="rounded-[10px] bg-[var(--altus-soft)] p-3 text-[var(--altus-text)]">
                  Method: <strong>priority_tier</strong> · Premier preferred for
                  HOT/PRIORITY leads · eligibility always required
                </p>
              </>
            ) : (
              <>
                <p>
                  Subscriber-owned leads stay with your organization. Internal routing
                  to teams/agents is configured separately from platform distribution.
                </p>
                <p className="rounded-[10px] bg-[var(--altus-soft)] p-3 text-[var(--altus-text)]">
                  Method: <strong>campaign_owner</strong> · internal assignment next
                </p>
              </>
            )}
          </div>
        )}

        {step === "review" && (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Owner", draft.owner_type],
              ["Goal", draft.goal],
              ["Strategy", draft.strategy],
              ["Territories", draft.territories.join(", ") || "—"],
              ["Channels", draft.channels.join(", ") || "—"],
              ["Destination", draft.destination],
              ["Budget", `$${((draft.budget_cents ?? 0) / 100).toLocaleString()}`],
              ["Qualification", draft.qualification_template_key ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[10px] border border-[var(--altus-border)] p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                  {label}
                </dt>
                <dd className="mt-1 font-medium text-[var(--altus-text)]">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {step === "launch" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--altus-text-secondary)]">
              Launch creates an active campaign record and queues mocked channel
              runs. No live ads are published in this milestone.
            </p>
            <button
              type="button"
              onClick={handleLaunch}
              className="rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--altus-blue-deep)]"
            >
              Launch Campaign
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          className="rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold text-[var(--altus-text)] disabled:opacity-40"
        >
          Back
        </button>
        {step !== "launch" ? (
          <button
            type="button"
            onClick={() =>
              setStepIndex((i) => Math.min(BUILDER_STEPS.length - 1, i + 1))
            }
            className="rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            Continue
          </button>
        ) : null}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-[8px] border border-[var(--altus-border)] bg-white px-3 py-2 text-sm text-[var(--altus-text)] outline-none focus:border-[var(--altus-blue)]";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-semibold text-[var(--altus-text)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[10px] border px-3 py-3 text-left text-sm font-semibold capitalize transition",
        selected
          ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
          : "border-[var(--altus-border)] text-[var(--altus-text)] hover:border-[var(--altus-blue)]/40",
      )}
    >
      {label}
    </button>
  );
}

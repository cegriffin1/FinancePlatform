"use client";

/**
 * Launch-ready 8-step campaign wizard.
 * Goal → Channels → Audience → Creative → Budget → Experience → Review → Launch
 * Auto-saves drafts. Simulation launch does not spend real ad dollars.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const STEPS = [
  { key: "goal", label: "Goal" },
  { key: "channels", label: "Channels" },
  { key: "audience", label: "Audience" },
  { key: "creative", label: "Creative" },
  { key: "budget", label: "Budget" },
  { key: "experience", label: "Experience" },
  { key: "review", label: "Review" },
  { key: "launch", label: "Launch" },
] as const;

const GOALS = [
  {
    key: "generate_retirement_opportunities",
    label: "Generate Retirement Opportunities",
    blurb: "ALTUS optimizes for qualified retirement profiles with Opportunity Score and HOT/MEDIUM/COLD readiness.",
    primary: true,
  },
  {
    key: "generate_leads",
    label: "Generate Qualified Leads",
    blurb: "Track qualified lead volume, cost per qualified opportunity, and campaign health.",
    primary: false,
  },
  {
    key: "book_appointments",
    label: "Book Appointments",
    blurb: "Prioritize appointment requests and setter-verified conversations.",
    primary: false,
  },
  {
    key: "retirement_education",
    label: "Retirement Education",
    blurb: "Awareness-oriented traffic into the retirement assessment experience.",
    primary: false,
  },
  {
    key: "retarget_prospects",
    label: "Retarget Prospects",
    blurb: "Re-engage prior visitors who started but did not complete the assessment.",
    primary: false,
  },
] as const;

const CHANNELS = [
  { key: "facebook", label: "Facebook", provider: "meta", connected: true },
  { key: "instagram", label: "Instagram", provider: "meta", connected: true },
  { key: "linkedin", label: "LinkedIn", provider: "linkedin", connected: true },
  { key: "tiktok", label: "TikTok", provider: "tiktok", connected: false },
] as const;

const AGE_RANGES = ["45–54", "55–64", "65–74", "55+"] as const;
const LOCATIONS = ["FL", "TX", "CA", "GA", "NY", "Nationwide"] as const;

type DraftState = {
  name: string;
  goal: string;
  channels: string[];
  locations: string[];
  ageRange: string;
  interests: string;
  retargeting: boolean;
  advancedOpen: boolean;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  creativeVariant: "A" | "B";
  previewChannel: string;
  budgetMode: "daily" | "total";
  budget: number;
  autoDistribute: boolean;
  allocations: Record<string, number>;
  startDate: string;
  endDate: string;
};

const DRAFT_KEY = "altus-campaign-wizard-draft-v1";

function defaultDraft(): DraftState {
  return {
    name: "Retirement Confidence Campaign",
    goal: "generate_retirement_opportunities",
    channels: ["facebook", "instagram", "linkedin"],
    locations: ["FL"],
    ageRange: "55–64",
    interests: "Retirement planning, wealth protection",
    retargeting: false,
    advancedOpen: false,
    primaryText:
      "Discover how your retirement goals, timeline, and money priorities fit together.",
    headline: "Build Your Retirement Profile",
    description:
      "A short, private assessment helps you organize what matters before speaking with a professional.",
    cta: "Start Assessment",
    creativeVariant: "A",
    previewChannel: "facebook",
    budgetMode: "total",
    budget: 3000,
    autoDistribute: true,
    allocations: {},
    startDate: new Date().toISOString().slice(0, 10),
    endDate: "",
  };
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function track(event: string, payload: Record<string, unknown> = {}) {
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, payload, at: new Date().toISOString() }),
  }).catch(() => undefined);
}

type Props = {
  ownerType?: "ALTUS_PLATFORM_CAMPAIGN" | "SUBSCRIBER_CAMPAIGN";
};

type LaunchChannelStatus = {
  channel: string;
  status: "LIVE" | "FAILED" | "SKIPPED";
  message?: string;
};

export function LaunchCampaignWizard({
  ownerType = "SUBSCRIBER_CAMPAIGN",
}: Props) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<DraftState>(defaultDraft);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchPhase, setLaunchPhase] = useState<string | null>(null);
  const [channelStatuses, setChannelStatuses] = useState<LaunchChannelStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const launchLock = useRef(false);

  useEffect(() => {
    track("campaign_wizard_started", { ownerType });
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftState;
        setDraft({ ...defaultDraft(), ...parsed });
      }
    } catch {
      // ignore
    }
    hydrated.current = true;
  }, [ownerType]);

  const persistLocal = useCallback((next: DraftState) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const autoSave = useCallback(
    (next: DraftState) => {
      setDraft(next);
      persistLocal(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        setSaving(true);
        void fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_draft",
            draftId: campaignId,
            draft: {
              owner_type: ownerType,
              name: next.name,
              goal: next.goal,
              channels: next.channels,
              locations: next.locations,
              budget: next.budget,
              budget_mode: next.budgetMode,
            },
          }),
        })
          .then(async (r) => {
            const json = await r.json();
            if (r.ok && json.campaignId) setCampaignId(json.campaignId);
            setSavedAt(new Date().toLocaleTimeString());
            track("campaign_draft_saved", { step: STEPS[step]?.key });
          })
          .catch(() => undefined)
          .finally(() => setSaving(false));
      }, 600);
    },
    [campaignId, ownerType, persistLocal, step],
  );

  function patch(partial: Partial<DraftState>) {
    autoSave({ ...draft, ...partial });
  }

  const allocations = useMemo(() => {
    if (!draft.autoDistribute) {
      return draft.allocations;
    }
    const selected = draft.channels.filter((c) =>
      CHANNELS.some((ch) => ch.key === c),
    );
    if (selected.length === 0) return {};
    // Meta (FB+IG) share one pool when both selected
    const metaSelected = selected.filter(
      (c) => c === "facebook" || c === "instagram",
    );
    const others = selected.filter(
      (c) => c !== "facebook" && c !== "instagram",
    );
    const buckets: string[] = [];
    if (metaSelected.length) buckets.push("meta");
    buckets.push(...others);
    const each = Math.floor(draft.budget / buckets.length);
    const remainder = draft.budget - each * buckets.length;
    const result: Record<string, number> = {};
    buckets.forEach((b, i) => {
      result[b] = each + (i === 0 ? remainder : 0);
    });
    return result;
  }, [draft.autoDistribute, draft.allocations, draft.budget, draft.channels]);

  const liveChannels = draft.channels.filter((c) => {
    const def = CHANNELS.find((ch) => ch.key === c);
    return def?.connected;
  });
  const blockedChannels = draft.channels.filter((c) => {
    const def = CHANNELS.find((ch) => ch.key === c);
    return def && !def.connected;
  });

  const validation = {
    creative: Boolean(draft.headline && draft.cta),
    budget: draft.budget > 0,
    destination: true,
    tracking: true,
    assessment: true,
    channels: liveChannels.length > 0,
  };

  const canLaunch =
    validation.creative &&
    validation.budget &&
    validation.channels &&
    step === STEPS.length - 1;

  async function launchSimulation() {
    if (launchLock.current || launching) return;
    launchLock.current = true;
    setLaunching(true);
    setError(null);
    setChannelStatuses([]);
    track("campaign_publish_started", { mode: "simulation" });

    const phases = [
      "Preparing campaign...",
      "Creating channel campaigns...",
      "Validating tracking...",
      "Confirming assessment destination...",
    ];
    for (const p of phases) {
      setLaunchPhase(p);
      await new Promise((r) => setTimeout(r, 350));
    }

    try {
      const apiChannels = Array.from(
        new Set(
          liveChannels.map((c) => {
            if (c === "facebook" || c === "instagram") return "meta";
            return c;
          }),
        ),
      );

      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_and_launch",
          draft: {
            owner_type: ownerType,
            name: draft.name,
            description: `Retirement opportunities via ${draft.channels.join(", ")}`,
            goal:
              draft.goal === "generate_retirement_opportunities"
                ? "generate_leads"
                : draft.goal === "retirement_education"
                  ? "build_awareness"
                  : draft.goal === "retarget_prospects"
                    ? "generate_leads"
                    : draft.goal,
            strategy: "Retirement",
            secondary_strategies: [],
            audience: {
              personas: ["professional"],
              interests: draft.interests
                ? draft.interests.split(",").map((s) => s.trim())
                : [],
              relationship: draft.retargeting ? "existing_customer" : "prospect",
              geography: draft.locations.includes("Nationwide")
                ? ["US"]
                : draft.locations,
            },
            territories: draft.locations.includes("Nationwide")
              ? ["US"]
              : draft.locations,
            channels: apiChannels.length ? apiChannels : ["linkedin"],
            destination: "interactive_assessment",
            budget_cents: Math.round(draft.budget * 100),
            budget_mode: draft.budgetMode,
            start_date: draft.startDate || null,
            end_date: draft.endDate || null,
            target_lead_count: 50,
            landing_headline: draft.headline,
            landing_support: draft.description,
            branding: {
              organization_name:
                ownerType === "ALTUS_PLATFORM_CAMPAIGN"
                  ? "ALTUS"
                  : "Demo Organization",
              custom_cta: draft.cta,
              thank_you_message:
                "Your retirement profile is ready. A professional can review it with you.",
              primary_color: "#0068B5",
            },
            organization_slug:
              ownerType === "ALTUS_PLATFORM_CAMPAIGN" ? "altus" : "demo-org",
            qualification_template_key: "retirement-opportunity-v1",
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Launch failed");

      const statuses: LaunchChannelStatus[] = CHANNELS.filter((c) =>
        draft.channels.includes(c.key),
      ).map((c) => {
        if (!c.connected) {
          return {
            channel: c.label,
            status: "FAILED",
            message: "Account not connected — retry after connecting.",
          };
        }
        return { channel: c.label, status: "LIVE" };
      });
      setChannelStatuses(statuses);
      setCampaignId(json.campaign.id);
      setSuccess(true);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      track("campaign_publish_succeeded", {
        campaignId: json.campaign.id,
        live: statuses.filter((s) => s.status === "LIVE").length,
        failed: statuses.filter((s) => s.status === "FAILED").length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
      track("campaign_publish_failed", {
        message: err instanceof Error ? err.message : "unknown",
      });
    } finally {
      setLaunching(false);
      setLaunchPhase(null);
      launchLock.current = false;
    }
  }

  async function retryTikTok() {
    setChannelStatuses((prev) =>
      prev.map((s) =>
        s.channel === "TikTok"
          ? {
              channel: "TikTok",
              status: "FAILED",
              message:
                "TikTok still requires a connected account. Connect TikTok, then retry.",
            }
          : s,
      ),
    );
  }

  if (success && campaignId) {
    const liveCount = channelStatuses.filter((s) => s.status === "LIVE").length;
    const failed = channelStatuses.filter((s) => s.status === "FAILED");
    return (
      <div className="space-y-6">
        <div className="rounded-[16px] border border-[var(--altus-border)] bg-[linear-gradient(135deg,#003d75,#0074C8)] px-6 py-8 text-white shadow-[var(--altus-shadow)]">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-white/80">
            CAMPAIGN LAUNCHED · SIMULATED DATA
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
            {draft.name}
          </h2>
          <p className="mt-2 text-sm text-white/90">
            {liveCount} channel{liveCount === 1 ? "" : "s"} live
            {failed.length
              ? ` · ${failed.length} need attention`
              : ""}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/app/campaigns/${campaignId}`}
              className="rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-[var(--altus-blue)]"
            >
              View Campaign Health
            </Link>
            <Link
              href={`/app/campaigns/${campaignId}`}
              className="rounded-md border border-white/40 px-4 py-2.5 text-sm font-semibold text-white"
            >
              View Campaign
            </Link>
            <Link
              href="/app/campaigns/new"
              className="rounded-md border border-white/40 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Create Another Campaign
            </Link>
          </div>
        </div>

        <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
            Channel status
          </h3>
          <ul className="mt-3 space-y-2">
            {channelStatuses.map((s) => (
              <li
                key={s.channel}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="font-semibold">{s.channel}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase",
                    s.status === "LIVE"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-900",
                  )}
                >
                  {s.status === "LIVE" ? "✓ Live" : "! Failed"}
                </span>
                {s.status === "FAILED" && s.channel === "TikTok" ? (
                  <button
                    type="button"
                    onClick={() => void retryTikTok()}
                    className="text-xs font-semibold text-[var(--altus-blue)]"
                  >
                    Retry TikTok
                  </button>
                ) : null}
                {s.message ? (
                  <span className="w-full text-xs text-[var(--altus-text-secondary)]">
                    {s.message}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
          <h3 className="text-lg font-bold">What happens next</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[var(--altus-text)]">
            <li>Traffic begins arriving (simulation or live channels)</li>
            <li>ALTUS captures attribution</li>
            <li>Prospects complete the assessment</li>
            <li>ALTUS scores opportunities</li>
            <li>Qualified leads enter your workflow</li>
          </ol>
        </div>
      </div>
    );
  }

  const current = STEPS[step]!;

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-4 shadow-[var(--altus-shadow)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--altus-text-secondary)]">
              CREATE CAMPAIGN
            </p>
            <h1 className="mt-1 text-lg font-bold text-[var(--altus-text)] sm:text-xl">
              {draft.name}
            </h1>
          </div>
          <p className="text-xs text-[var(--altus-text-secondary)]" aria-live="polite">
            {saving
              ? "Saving draft…"
              : savedAt
                ? `Draft saved ${savedAt}`
                : "Draft auto-saves"}
          </p>
        </div>

        {/* Desktop step rail */}
        <nav
          className="mt-4 hidden gap-1 overflow-x-auto lg:flex"
          aria-label="Campaign steps"
        >
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-semibold",
                i === step
                  ? "bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                  : i < step
                    ? "text-[var(--altus-text)]"
                    : "text-[var(--altus-text-secondary)]",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]",
                  i <= step
                    ? "bg-[var(--altus-blue)] text-white"
                    : "bg-[var(--altus-section)]",
                )}
                aria-hidden
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </nav>

        {/* Mobile compact */}
        <div className="mt-3 lg:hidden">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>
              Step {step + 1} of {STEPS.length}
            </span>
            <span className="text-[var(--altus-blue)]">{current.label}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--altus-soft)]">
            <div
              className="h-full bg-[var(--altus-blue)] transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)] sm:p-6">
        {current.key === "goal" && (
          <StepGoal draft={draft} onPatch={patch} />
        )}
        {current.key === "channels" && (
          <StepChannels draft={draft} onPatch={patch} />
        )}
        {current.key === "audience" && (
          <StepAudience draft={draft} onPatch={patch} />
        )}
        {current.key === "creative" && (
          <StepCreative draft={draft} onPatch={patch} />
        )}
        {current.key === "budget" && (
          <StepBudget
            draft={draft}
            allocations={allocations}
            onPatch={patch}
          />
        )}
        {current.key === "experience" && (
          <StepExperience
            onPreview={() => setPreviewOpen(true)}
          />
        )}
        {current.key === "review" && (
          <StepReview
            draft={draft}
            allocations={allocations}
            validation={validation}
            blockedChannels={blockedChannels}
            liveChannels={liveChannels}
          />
        )}
        {current.key === "launch" && (
          <StepLaunch
            draft={draft}
            liveChannels={liveChannels}
            blockedChannels={blockedChannels}
            launching={launching}
            launchPhase={launchPhase}
            error={error}
            canLaunch={canLaunch}
            onLaunch={() => void launchSimulation()}
          />
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          disabled={step === 0 || launching}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="min-h-11 rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => {
              if (current.key === "review") track("campaign_reviewed", {});
              setStep((s) => Math.min(STEPS.length - 1, s + 1));
            }}
            className="min-h-11 rounded-md bg-[var(--altus-blue)] px-5 py-2 text-sm font-semibold text-white"
          >
            Continue
          </button>
        ) : null}
      </div>

      {previewOpen ? (
        <PreviewModal onClose={() => setPreviewOpen(false)} />
      ) : null}
    </div>
  );
}

function StepGoal({
  draft,
  onPatch,
}: {
  draft: DraftState;
  onPatch: (p: Partial<DraftState>) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight">
        What do you want this campaign to accomplish?
      </h2>
      <label className="block space-y-1 text-sm font-semibold">
        Campaign name
        <input
          className={inputClass}
          value={draft.name}
          onChange={(e) => onPatch({ name: e.target.value })}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {GOALS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => onPatch({ goal: g.key })}
            className={cn(
              "min-h-11 rounded-[12px] border px-4 py-4 text-left transition",
              draft.goal === g.key
                ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] ring-2 ring-[var(--altus-soft)]"
                : "border-[var(--altus-border)] hover:border-[var(--altus-blue)]",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold">{g.label}</span>
              {g.primary ? (
                <span className="rounded-full bg-[var(--altus-blue)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  MVP
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-[var(--altus-text-secondary)]">
              {g.blurb}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepChannels({
  draft,
  onPatch,
}: {
  draft: DraftState;
  onPatch: (p: Partial<DraftState>) => void;
}) {
  function toggle(key: string) {
    const next = draft.channels.includes(key)
      ? draft.channels.filter((c) => c !== key)
      : [...draft.channels, key];
    onPatch({
      channels: next,
      previewChannel: next[0] ?? draft.previewChannel,
    });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight">
        Where should this campaign run?
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((ch) => {
          const selected = draft.channels.includes(ch.key);
          return (
            <div
              key={ch.key}
              className={cn(
                "rounded-[12px] border p-4",
                selected
                  ? "border-[var(--altus-blue)] bg-[var(--altus-soft)]"
                  : "border-[var(--altus-border)]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-bold">{ch.label}</div>
                  <div className="mt-1 text-xs text-[var(--altus-text-secondary)]">
                    {ch.connected
                      ? "Account connected"
                      : "Not connected"}
                  </div>
                </div>
                <span aria-hidden className="text-lg font-bold text-[var(--altus-blue)]">
                  {ch.label[0]}
                </span>
              </div>
              {ch.connected ? (
                <button
                  type="button"
                  onClick={() => toggle(ch.key)}
                  className="mt-3 min-h-11 w-full rounded-md border border-[var(--altus-border)] bg-white px-3 py-2 text-sm font-semibold"
                >
                  {selected ? "✓ Selected" : "Select"}
                </button>
              ) : (
                <a
                  href="/app/settings/integrations"
                  className="mt-3 flex min-h-11 items-center justify-center rounded-md bg-[var(--altus-blue)] px-3 py-2 text-sm font-semibold text-white"
                >
                  Connect Account
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StepAudience({
  draft,
  onPatch,
}: {
  draft: DraftState;
  onPatch: (p: Partial<DraftState>) => void;
}) {
  const linkedInSelected = draft.channels.includes("linkedin");

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-tight">
        Who should see this campaign?
      </h2>

      <fieldset>
        <legend className="text-sm font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
          Location
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => {
                if (loc === "Nationwide") {
                  onPatch({ locations: ["Nationwide"] });
                  return;
                }
                const withoutNation = draft.locations.filter(
                  (l) => l !== "Nationwide",
                );
                const next = withoutNation.includes(loc)
                  ? withoutNation.filter((l) => l !== loc)
                  : [...withoutNation, loc];
                onPatch({ locations: next.length ? next : ["FL"] });
              }}
              className={cn(
                "min-h-11 rounded-full border px-4 py-2 text-sm font-semibold",
                draft.locations.includes(loc)
                  ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                  : "border-[var(--altus-border)]",
              )}
            >
              {loc}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
          Age range
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {AGE_RANGES.map((age) => (
            <button
              key={age}
              type="button"
              onClick={() => onPatch({ ageRange: age })}
              className={cn(
                "min-h-11 rounded-full border px-4 py-2 text-sm font-semibold",
                draft.ageRange === age
                  ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                  : "border-[var(--altus-border)]",
              )}
            >
              {age}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1 text-sm font-semibold">
        Audience / interest configuration
        <input
          className={inputClass}
          value={draft.interests}
          onChange={(e) => onPatch({ interests: e.target.value })}
          placeholder="e.g. Retirement planning"
        />
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={draft.retargeting}
          onChange={(e) => onPatch({ retargeting: e.target.checked })}
        />
        Optional retargeting (prior assessment visitors)
      </label>

      <button
        type="button"
        className="text-sm font-semibold text-[var(--altus-blue)]"
        onClick={() => onPatch({ advancedOpen: !draft.advancedOpen })}
      >
        {draft.advancedOpen ? "Hide" : "Show"} Advanced Options
      </button>

      {draft.advancedOpen ? (
        <div className="rounded-[10px] border border-dashed border-[var(--altus-border)] p-4 text-sm">
          <p className="font-semibold">Provider limitations</p>
          {linkedInSelected ? (
            <p className="mt-2 text-[var(--altus-text-secondary)]">
              LinkedIn does not support Meta-style detailed interest clusters.
              Age and location are applied; interest text is stored for creative
              guidance only.
            </p>
          ) : (
            <p className="mt-2 text-[var(--altus-text-secondary)]">
              Advanced lookalike and exclusion lists will appear when live
              provider publishing is enabled.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function StepCreative({
  draft,
  onPatch,
}: {
  draft: DraftState;
  onPatch: (p: Partial<DraftState>) => void;
}) {
  const previewTabs = draft.channels.length
    ? draft.channels
    : ["facebook"];

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-tight">
        What will prospects see?
      </h2>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondaryBtn}>
          Upload Video
        </button>
        <button type="button" className={secondaryBtn}>
          Upload Image
        </button>
        <button type="button" className={secondaryBtn}>
          Choose Existing Creative
        </button>
      </div>

      <div className="flex gap-2">
        {(["A", "B"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPatch({ creativeVariant: v })}
            className={cn(
              "min-h-11 rounded-md border px-4 py-2 text-sm font-semibold",
              draft.creativeVariant === v
                ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                : "border-[var(--altus-border)]",
            )}
          >
            Creative {v}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block space-y-1 text-sm font-semibold">
            Primary text
            <textarea
              className={inputClass}
              rows={3}
              value={draft.primaryText}
              onChange={(e) => onPatch({ primaryText: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm font-semibold">
            Headline
            <input
              className={inputClass}
              value={draft.headline}
              onChange={(e) => onPatch({ headline: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm font-semibold">
            Description
            <textarea
              className={inputClass}
              rows={2}
              value={draft.description}
              onChange={(e) => onPatch({ description: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm font-semibold">
            CTA
            <input
              className={inputClass}
              value={draft.cta}
              onChange={(e) => onPatch({ cta: e.target.value })}
            />
          </label>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {previewTabs.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => onPatch({ previewChannel: ch })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold capitalize",
                  draft.previewChannel === ch
                    ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                    : "border-[var(--altus-border)]",
                )}
              >
                {ch}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-section)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Live preview · {draft.previewChannel} · Creative{" "}
              {draft.creativeVariant}
            </p>
            <div className="mt-3 aspect-video rounded-lg bg-[linear-gradient(135deg,#003d75,#4ea3e0)]" />
            <h3 className="mt-3 text-lg font-bold">{draft.headline}</h3>
            <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
              {draft.primaryText}
            </p>
            <p className="mt-2 text-xs text-[var(--altus-text-secondary)]">
              {draft.description}
            </p>
            <button
              type="button"
              className="mt-3 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
            >
              {draft.cta}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBudget({
  draft,
  allocations,
  onPatch,
}: {
  draft: DraftState;
  allocations: Record<string, number>;
  onPatch: (p: Partial<DraftState>) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-tight">
        How much would you like to invest?
      </h2>
      <p className="text-sm text-[var(--altus-text-secondary)]">
        Simulation mode does not spend real advertising dollars.
      </p>

      <div className="flex flex-wrap gap-2">
        {(["total", "daily"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onPatch({ budgetMode: m })}
            className={cn(
              "min-h-11 rounded-md border px-4 py-2 text-sm font-semibold capitalize",
              draft.budgetMode === m
                ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                : "border-[var(--altus-border)]",
            )}
          >
            {m === "total" ? "Total campaign budget" : "Daily budget"}
          </button>
        ))}
      </div>

      <label className="block space-y-1 text-sm font-semibold">
        Amount (USD)
        <input
          type="number"
          min={100}
          className={inputClass}
          value={draft.budget}
          onChange={(e) => onPatch({ budget: Number(e.target.value) || 0 })}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPatch({ autoDistribute: true })}
          className={cn(
            "min-h-11 rounded-md border px-4 py-2 text-sm font-semibold",
            draft.autoDistribute
              ? "border-[var(--altus-blue)] bg-[var(--altus-soft)]"
              : "border-[var(--altus-border)]",
          )}
        >
          Automatically distribute
        </button>
        <button
          type="button"
          onClick={() =>
            onPatch({
              autoDistribute: false,
              allocations: { ...allocations },
            })
          }
          className={cn(
            "min-h-11 rounded-md border px-4 py-2 text-sm font-semibold",
            !draft.autoDistribute
              ? "border-[var(--altus-blue)] bg-[var(--altus-soft)]"
              : "border-[var(--altus-border)]",
          )}
        >
          Customize by channel
        </button>
      </div>

      <div className="rounded-[12px] border border-[var(--altus-border)] p-4">
        <div className="text-sm font-bold">
          {draft.budgetMode === "total" ? "TOTAL CAMPAIGN BUDGET" : "DAILY BUDGET"}{" "}
          {money(draft.budget)}
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {Object.entries(allocations).map(([key, amount]) => (
            <li key={key} className="flex justify-between gap-2">
              <span className="capitalize">
                {key === "meta" ? "Facebook + Instagram" : key}
              </span>
              {!draft.autoDistribute ? (
                <input
                  type="number"
                  className="w-28 rounded border px-2 py-1 text-right"
                  value={draft.allocations[key] ?? amount}
                  onChange={(e) =>
                    onPatch({
                      allocations: {
                        ...draft.allocations,
                        [key]: Number(e.target.value) || 0,
                      },
                    })
                  }
                />
              ) : (
                <span className="font-semibold">{money(amount)}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold">
          Start date
          <input
            type="date"
            className={inputClass}
            value={draft.startDate}
            onChange={(e) => onPatch({ startDate: e.target.value })}
          />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          End date (optional)
          <input
            type="date"
            className={inputClass}
            value={draft.endDate}
            onChange={(e) => onPatch({ endDate: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

function StepExperience({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-tight">
        What happens after someone clicks?
      </h2>

      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {["AD", "ALTUS", "RETIREMENT ASSESSMENT", "RETIREMENT PROFILE", "APPOINTMENT"].map(
          (label, i, arr) => (
            <span key={label} className="flex items-center gap-2">
              <span className="rounded-md bg-[var(--altus-soft)] px-3 py-2 text-[var(--altus-blue)]">
                {label}
              </span>
              {i < arr.length - 1 ? (
                <span aria-hidden className="text-[var(--altus-text-secondary)]">
                  →
                </span>
              ) : null}
            </span>
          ),
        )}
      </div>

      <div className="rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-section)] p-5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
          Destination
        </p>
        <p className="mt-1 text-lg font-bold">
          ALTUS Retirement Opportunity Assessment
        </p>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Prospects land on the ALTUS homepage assessment — no unnecessary page
          hops.
        </p>
        <button
          type="button"
          onClick={onPreview}
          className="mt-4 min-h-11 rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          Preview Experience
        </button>
      </div>
    </div>
  );
}

function StepReview({
  draft,
  allocations,
  validation,
  blockedChannels,
  liveChannels,
}: {
  draft: DraftState;
  allocations: Record<string, number>;
  validation: Record<string, boolean>;
  blockedChannels: string[];
  liveChannels: string[];
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-tight">
        Your campaign is ready for review.
      </h2>

      <ReviewBlock title="Campaign">
        <Row label="Goal" value={draft.goal.replaceAll("_", " ")} />
        <Row label="Name" value={draft.name} />
        <Row
          label="Dates"
          value={`${draft.startDate || "—"} → ${draft.endDate || "Open"}`}
        />
      </ReviewBlock>

      <ReviewBlock title="Channels">
        <Row label="Selected" value={draft.channels.join(", ") || "—"} />
        <Row label="Ready to launch" value={liveChannels.join(", ") || "—"} />
      </ReviewBlock>

      <ReviewBlock title="Audience">
        <Row label="Location" value={draft.locations.join(", ")} />
        <Row label="Age" value={draft.ageRange} />
        <Row label="Targeting" value={draft.interests} />
      </ReviewBlock>

      <ReviewBlock title="Creative">
        <Row label="Headline" value={draft.headline} />
        <Row label="CTA" value={draft.cta} />
        <Row label="Variant" value={`Creative ${draft.creativeVariant}`} />
      </ReviewBlock>

      <ReviewBlock title="Budget">
        <Row
          label={draft.budgetMode === "total" ? "Total" : "Daily"}
          value={money(draft.budget)}
        />
        <Row
          label="Allocation"
          value={Object.entries(allocations)
            .map(([k, v]) => `${k === "meta" ? "Meta" : k}: ${money(v)}`)
            .join(" · ")}
        />
      </ReviewBlock>

      <ReviewBlock title="Experience">
        <Row label="Destination" value="ALTUS Retirement Assessment" />
      </ReviewBlock>

      <ReviewBlock title="Tracking">
        <Row label="Attribution" value="Enabled" />
        <Row label="Lead scoring" value="Enabled" />
        <Row label="Campaign health" value="Enabled" />
      </ReviewBlock>

      <ul className="space-y-1 text-sm">
        {(
          [
            ["Creative Ready", validation.creative],
            ["Budget Ready", validation.budget],
            ["Destination Ready", validation.destination],
            ["Tracking Ready", validation.tracking],
            ["Assessment Ready", validation.assessment],
          ] as const
        ).map(([label, ok]) => (
          <li key={label} className="font-semibold">
            {ok ? "✓" : "!"} {label}
          </li>
        ))}
      </ul>

      <div className="rounded-[10px] border border-[var(--altus-border)] p-4 text-sm">
        <p className="font-bold">Provider connection status</p>
        <ul className="mt-2 space-y-1">
          {CHANNELS.filter((c) => draft.channels.includes(c.key)).map((c) => (
            <li key={c.key}>
              {c.connected ? "✓" : "!"} {c.label}
              {!c.connected ? " requires attention" : ""}
            </li>
          ))}
        </ul>
        {blockedChannels.length ? (
          <p className="mt-2 text-amber-800">
            Launch blockers: {blockedChannels.join(", ")} will not go live until
            connected. Other channels can still launch.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function StepLaunch({
  draft,
  liveChannels,
  blockedChannels,
  launching,
  launchPhase,
  error,
  canLaunch,
  onLaunch,
}: {
  draft: DraftState;
  liveChannels: string[];
  blockedChannels: string[];
  launching: boolean;
  launchPhase: string | null;
  error: string | null;
  canLaunch: boolean;
  onLaunch: () => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-tight">Ready to Launch?</h2>
      <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
        SIMULATION MODE — no real advertising spend. Clearly labeled simulated
        data.
      </p>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Row label="Channels" value={liveChannels.join(", ") || "None ready"} />
        <Row label="Budget" value={money(draft.budget)} />
        <Row label="Start date" value={draft.startDate || "—"} />
        <Row label="Destination" value="ALTUS Retirement Assessment" />
      </div>

      {blockedChannels.length ? (
        <p className="text-sm text-amber-900">
          {blockedChannels.join(", ")} will show as FAILED until connected.
          Facebook / Instagram / LinkedIn can still go live in simulation.
        </p>
      ) : null}

      {launchPhase ? (
        <p className="text-sm font-semibold text-[var(--altus-blue)]" aria-live="polite">
          {launchPhase}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canLaunch || launching || liveChannels.length === 0}
        onClick={onLaunch}
        className="min-h-12 w-full rounded-md bg-[var(--altus-blue)] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-50 sm:w-auto"
      >
        {launching ? "Launching…" : "Launch Campaign"}
      </button>
      <p className="text-xs text-[var(--altus-text-secondary)]">
        Save never publishes. Launch requires this explicit confirmation.
      </p>
    </div>
  );
}

function PreviewModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Preview prospect journey"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[16px] bg-white shadow-xl sm:rounded-[16px]">
        <div className="flex items-center justify-between border-b border-[var(--altus-border)] px-4 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Preview · no production traffic
            </p>
            <p className="text-sm font-semibold">Prospect journey</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-md border border-[var(--altus-border)] px-3 text-sm font-semibold"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          <iframe
            title="Prospect experience preview"
            src="/?preview=1#retirement-assessment"
            className="h-[70vh] w-full rounded-[12px] border border-[var(--altus-border)]"
          />
        </div>
      </div>
    </div>
  );
}

function ReviewBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-[var(--altus-border)] p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--altus-text-secondary)]">
        {title}
      </h3>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <span className="text-[var(--altus-text-secondary)]">{label}</span>
      <span className="font-semibold text-[var(--altus-text)]">{value}</span>
    </div>
  );
}

const inputClass =
  "mt-1 w-full min-h-11 rounded-[8px] border border-[var(--altus-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--altus-blue)]";

const secondaryBtn =
  "min-h-11 rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold";

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";

const STEPS = [
  "Goal",
  "Audience",
  "Strategy",
  "Territory",
  "Channels",
  "Budget",
  "Lead Experience",
  "Distribution",
  "Review",
] as const;

const GOALS = [
  { key: "generate_leads", label: "Generate Leads", ready: true },
  { key: "book_appointments", label: "Book Appointments", ready: true },
  { key: "promote_strategy", label: "Promote a Strategy", ready: false },
  { key: "build_awareness", label: "Build Awareness", ready: false },
  { key: "download_resource", label: "Download Resource", ready: false },
  { key: "webinar_event", label: "Webinar / Event", ready: false },
] as const;

const STRATEGIES = [
  "Business Growth",
  "Tax Strategy",
  "Succession",
  "Key Employee Strategy",
  "Executive Benefits",
  "Protection",
  "Retirement",
  "Premium Financing",
] as const;

const INDUSTRIES = [
  "Professional Services",
  "Construction",
  "Healthcare",
  "Real Estate",
  "Manufacturing",
  "Transportation",
  "Technology",
  "Financial Services",
  "Hospitality",
  "Retail",
  "Other",
];

const COMPANY_SIZES = [
  "Solo",
  "2–10",
  "11–25",
  "26–50",
  "51–100",
  "101–250",
  "250+",
];

const REVENUE = [
  "Under $250K",
  "$250K–$500K",
  "$500K–$1M",
  "$1M–$5M",
  "$5M–$10M",
  "$10M+",
];

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const CHANNELS = [
  { key: "meta", label: "Facebook / Instagram", status: "Ready for Simulation" },
  { key: "linkedin", label: "LinkedIn", status: "Ready for Simulation" },
  { key: "google", label: "Google", status: "Ready for Simulation" },
  { key: "tiktok", label: "TikTok", status: "Coming Soon" },
  { key: "email", label: "Email", status: "Ready for Simulation" },
  { key: "sms", label: "SMS", status: "Coming Soon" },
] as const;

type Props = {
  ownerType?: "ALTUS_PLATFORM_CAMPAIGN" | "SUBSCRIBER_CAMPAIGN";
  eligibleTerritories?: string[];
};

export function VerticalCampaignWizard({
  ownerType = "SUBSCRIBER_CAMPAIGN",
  eligibleTerritories = ["FL", "TX", "CA", "GA", "NY"],
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    publicPath: string;
    campaignId: string;
  } | null>(null);

  const [name, setName] = useState("Business Growth Lead Campaign");
  const [goal, setGoal] = useState("generate_leads");
  const [audienceType, setAudienceType] = useState("Business Owner");
  const [industry, setIndustry] = useState("Manufacturing");
  const [companySize, setCompanySize] = useState("26–50");
  const [revenue, setRevenue] = useState("$5M–$10M");
  const [strategy, setStrategy] = useState("Business Growth");
  const [secondary, setSecondary] = useState<string[]>([]);
  const [territories, setTerritories] = useState<string[]>(["FL"]);
  const [nationwide, setNationwide] = useState(false);
  const [channels, setChannels] = useState<string[]>(["meta", "linkedin"]);
  const [budget, setBudget] = useState(2500);
  const [budgetMode, setBudgetMode] = useState<"daily" | "total">("total");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetLeads, setTargetLeads] = useState(50);
  const [destination, setDestination] = useState("interactive_assessment");
  const [headline, setHeadline] = useState(
    "Discover opportunities to strengthen your business.",
  );
  const [support, setSupport] = useState(
    "A short assessment helps us understand your priorities and connect you with relevant next steps.",
  );
  const [cta, setCta] = useState("Start Assessment");
  const [thanks, setThanks] = useState(
    "Thanks — an advisor will follow up shortly.",
  );

  const progress = useMemo(
    () => Math.round(((step + 1) / STEPS.length) * 100),
    [step],
  );

  function toggleSecondary(value: string) {
    setSecondary((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function toggleTerritory(code: string) {
    setTerritories((prev) =>
      prev.includes(code) ? prev.filter((v) => v !== code) : [...prev, code],
    );
  }

  function toggleChannel(key: string) {
    setChannels((prev) =>
      prev.includes(key) ? prev.filter((v) => v !== key) : [...prev, key],
    );
  }

  async function launch() {
    setLaunching(true);
    setError(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_and_launch",
          draft: {
            owner_type: ownerType,
            name,
            description: `${strategy} campaign for ${audienceType}`,
            goal,
            strategy,
            secondary_strategies: secondary,
            audience: {
              personas: [audienceType],
              industry,
              company_size: companySize,
              revenue_range: revenue,
              relationship:
                audienceType === "Existing Client"
                  ? "existing_customer"
                  : "prospect",
            },
            territories: nationwide ? ["US"] : territories,
            channels,
            destination,
            budget_cents: Math.round(budget * 100),
            budget_mode: budgetMode,
            start_date: startDate || null,
            end_date: endDate || null,
            target_lead_count: targetLeads,
            landing_headline: headline,
            landing_support: support,
            branding: {
              organization_name:
                ownerType === "ALTUS_PLATFORM_CAMPAIGN"
                  ? "ALTUS"
                  : "Demo Organization",
              custom_cta: cta,
              thank_you_message: thanks,
              primary_color: "#0068B5",
            },
            organization_slug:
              ownerType === "ALTUS_PLATFORM_CAMPAIGN" ? "altus" : "demo-org",
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Launch failed");
      setResult({
        publicPath: json.publicPath,
        campaignId: json.campaign.id,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  if (result) {
    return (
      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-8 shadow-[var(--altus-shadow)]">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--altus-blue)]">
          ACTIVE SIMULATION
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[var(--altus-text)]">
          {name} is live in simulation mode
        </h2>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Public experience is ready. No live social APIs were called.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={result.publicPath}
            className="rounded-md bg-[var(--altus-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            Open public page
          </Link>
          <Link
            href="/app/campaigns"
            className="rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold"
          >
            Back to campaigns
          </Link>
          <button
            type="button"
            className="rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold text-[var(--altus-blue)]"
            onClick={async () => {
              await fetch("/api/dev/generate-test-lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId: result.campaignId }),
              });
              router.push("/app/leads");
            }}
          >
            Generate Test Lead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[var(--altus-text-secondary)]">
              CAMPAIGN WIZARD ·{" "}
              {ownerType === "ALTUS_PLATFORM_CAMPAIGN" ? "Platform" : "Subscriber"}
            </p>
            <h1 className="mt-1 text-xl font-bold text-[var(--altus-text)]">{name}</h1>
          </div>
          <p className="text-sm font-semibold text-[var(--altus-blue)]">
            Step {step + 1} of {STEPS.length} · {STEPS[step]}
          </p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--altus-soft)]">
          <div className="h-full bg-[var(--altus-blue)]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-[12px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)]">
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">What do you want this campaign to accomplish?</h2>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {GOALS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={!item.ready}
                  onClick={() => item.ready && setGoal(item.key)}
                  className={cn(
                    "rounded-[10px] border px-3 py-3 text-left text-sm font-semibold",
                    goal === item.key
                      ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                      : "border-[var(--altus-border)]",
                    !item.ready && "opacity-50",
                  )}
                >
                  {item.label}
                  {!item.ready ? (
                    <span className="mt-1 block text-[10px] font-medium text-[var(--altus-text-secondary)]">
                      Coming Soon
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Audience Type" value={audienceType} onChange={setAudienceType} options={["Business Owner","Executive","Professional","Existing Prospect","Existing Client"]} />
            <Select label="Industry" value={industry} onChange={setIndustry} options={INDUSTRIES} />
            <Select label="Company Size" value={companySize} onChange={setCompanySize} options={COMPANY_SIZES} />
            <Select label="Revenue Range" value={revenue} onChange={setRevenue} options={REVENUE} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--altus-text-secondary)]">
              Select one primary strategy and optional secondary classifications. These are internal routing labels — not financial recommendations.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {STRATEGIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStrategy(item)}
                  className={cn(
                    "rounded-[10px] border px-3 py-3 text-left text-sm font-semibold",
                    strategy === item
                      ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                      : "border-[var(--altus-border)]",
                  )}
                >
                  {item}
                  {strategy === item ? (
                    <span className="mt-1 block text-[10px]">Primary</span>
                  ) : null}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {STRATEGIES.filter((s) => s !== strategy).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleSecondary(item)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    secondary.includes(item)
                      ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                      : "border-[var(--altus-border)] text-[var(--altus-text-secondary)]",
                  )}
                >
                  + {item}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={nationwide}
                onChange={(e) => setNationwide(e.target.checked)}
              />
              Nationwide
            </label>
            {!nationwide ? (
              <div className="flex flex-wrap gap-2">
                {(ownerType === "SUBSCRIBER_CAMPAIGN"
                  ? eligibleTerritories
                  : STATES
                ).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleTerritory(code)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-semibold",
                      territories.includes(code)
                        ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                        : "border-[var(--altus-border)]",
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {step === 4 && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNELS.map((channel) => (
              <button
                key={channel.key}
                type="button"
                disabled={channel.status === "Coming Soon"}
                onClick={() => toggleChannel(channel.key)}
                className={cn(
                  "rounded-[10px] border px-3 py-3 text-left",
                  channels.includes(channel.key)
                    ? "border-[var(--altus-blue)] bg-[var(--altus-soft)]"
                    : "border-[var(--altus-border)]",
                  channel.status === "Coming Soon" && "opacity-50",
                )}
              >
                <div className="text-sm font-semibold">{channel.label}</div>
                <div className="mt-1 text-[11px] text-[var(--altus-text-secondary)]">
                  {channel.status}
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-semibold">
              Campaign budget (USD)
              <input
                type="number"
                className={inputClass}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
              />
            </label>
            <Select
              label="Budget type"
              value={budgetMode}
              onChange={(v) => setBudgetMode(v as "daily" | "total")}
              options={["total", "daily"]}
            />
            <label className="block space-y-1 text-sm font-semibold">
              Start date
              <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              End date
              <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-semibold sm:col-span-2">
              Target lead count (optional)
              <input type="number" className={inputClass} value={targetLeads} onChange={(e) => setTargetLeads(Number(e.target.value))} />
            </label>
            <p className="sm:col-span-2 rounded-[10px] bg-[var(--altus-soft)] p-3 text-sm text-[var(--altus-text-secondary)]">
              Lead volume estimates will be available after channel integrations are enabled.
            </p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                { key: "interactive_assessment", label: "Interactive Assessment", ready: true },
                { key: "lead_form", label: "Lead Form", ready: false },
                { key: "appointment_page", label: "Appointment Page", ready: false },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  disabled={!item.ready}
                  onClick={() => item.ready && setDestination(item.key)}
                  className={cn(
                    "rounded-[10px] border px-3 py-3 text-sm font-semibold",
                    destination === item.key
                      ? "border-[var(--altus-blue)] bg-[var(--altus-soft)] text-[var(--altus-blue)]"
                      : "border-[var(--altus-border)]",
                    !item.ready && "opacity-50",
                  )}
                >
                  {item.label}
                  {!item.ready ? <span className="mt-1 block text-[10px]">Coming Soon</span> : null}
                </button>
              ))}
            </div>
            <label className="block space-y-1 text-sm font-semibold">
              Landing page headline
              <input className={inputClass} value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              Supporting copy
              <textarea className={inputClass} rows={3} value={support} onChange={(e) => setSupport(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              CTA
              <input className={inputClass} value={cta} onChange={(e) => setCta(e.target.value)} />
            </label>
            <label className="block space-y-1 text-sm font-semibold">
              Thank-you message
              <textarea className={inputClass} rows={2} value={thanks} onChange={(e) => setThanks(e.target.value)} />
            </label>
            <p className="text-xs text-[var(--altus-text-secondary)]">
              Assessment template: <strong>business-growth-assessment-v1</strong>
            </p>
          </div>
        )}

        {step === 7 && (
          <div className="space-y-3 text-sm text-[var(--altus-text-secondary)]">
            {ownerType === "ALTUS_PLATFORM_CAMPAIGN" ? (
              <p>
                Platform leads enter the ALTUS distribution pool and route to eligible
                subscribers using territory, licensing, strategy, capacity, and Premier priority.
              </p>
            ) : (
              <p>
                Subscriber-owned leads remain with your organization and route internally to
                teams/agents. They never enter the ALTUS platform pool.
              </p>
            )}
          </div>
        )}

        {step === 8 && (
          <div className="space-y-3 text-sm">
            <ReviewRow label="Goal" value={goal.replaceAll("_", " ")} />
            <ReviewRow label="Audience" value={`${audienceType} · ${industry} · ${companySize} · ${revenue}`} />
            <ReviewRow label="Strategy" value={`${strategy}${secondary.length ? ` + ${secondary.join(", ")}` : ""}`} />
            <ReviewRow label="Territory" value={nationwide ? "Nationwide" : territories.join(", ")} />
            <ReviewRow label="Channels" value={channels.join(", ")} />
            <ReviewRow label="Budget" value={`$${budget.toLocaleString()} (${budgetMode})`} />
            <ReviewRow label="Experience" value={destination.replaceAll("_", " ")} />
            {error ? <p className="text-[var(--danger)]">{error}</p> : null}
            <button
              type="button"
              disabled={launching}
              onClick={launch}
              className="rounded-md bg-[var(--altus-blue)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {launching ? "Launching…" : "Launch Campaign"}
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-md border border-[var(--altus-border)] px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
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
  "w-full rounded-[8px] border border-[var(--altus-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--altus-blue)]";

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block space-y-1 text-sm font-semibold">
      {label}
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--altus-border)] px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
        {label}
      </div>
      <div className="mt-1 font-medium text-[var(--altus-text)]">{value}</div>
    </div>
  );
}

import Link from "next/link";

export default function MarketingAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/marketing"
          className="text-sm font-semibold text-[var(--altus-blue)]"
        >
          ← Marketing
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Cross-platform performance
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
          Future home for campaign analytics, conversion reporting, and lead-source
          attribution across Meta, TikTok, and LinkedIn. Simulation metrics sync
          already exists for Meta/LinkedIn/Google ad campaigns; LIVE reporting
          requires connected accounts and provider approvals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Impressions", "Leads attributed", "Spend"].map((label) => (
          <div
            key={label}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              {label}
            </p>
            <p className="mt-3 text-2xl font-bold text-[var(--altus-text)]">—</p>
            <p className="mt-1 text-xs text-[var(--altus-text-secondary)]">
              Placeholder until LIVE sync is enabled
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

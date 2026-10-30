import Link from "next/link";
import { listMarketingFoundationModules } from "@/application/marketing/marketingFoundation";

export default function MarketingHubPage() {
  const modules = listMarketingFoundationModules();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Marketing
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
          ALTUS marketing controls for Highwater Capital — connected social accounts,
          content planning, analytics, and attribution. Publishing and ad spend stay
          gated until LIVE provider approvals.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((mod) => (
          <Link
            key={mod.key}
            href={mod.href}
            className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-[var(--altus-text)]">{mod.title}</h2>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
                {mod.status.replaceAll("_", " ")}
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
              {mod.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

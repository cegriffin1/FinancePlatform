import Link from "next/link";
import { listCampaignTemplates } from "@/application/campaigns/campaignCatalog";

export default function CampaignTemplatesPage() {
  const templates = listCampaignTemplates();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Campaign templates
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
            Clone a strategy template, customize territory/budget/channels, then
            launch. Save-as-my-template persists in a later phase.
          </p>
        </div>
        <Link
          href="/app/campaigns/new"
          className="rounded-md bg-[var(--altus-blue)] px-3.5 py-2 text-sm font-semibold text-white"
        >
          Start blank
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <article
            key={template.id}
            className="flex flex-col rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]"
          >
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--altus-blue)]">
              {template.strategy.toUpperCase()}
            </p>
            <h2 className="mt-2 text-lg font-bold text-[var(--altus-text)]">
              {template.name}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--altus-text-secondary)]">
              {template.description}
            </p>
            <p className="mt-3 text-xs text-[var(--altus-text-secondary)]">
              Destination: {template.default_destination.replaceAll("_", " ")} ·{" "}
              {template.default_channels.join(", ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/app/campaigns/new?template=${template.id}`}
                className="rounded-md bg-[var(--altus-blue)] px-3 py-2 text-xs font-semibold text-white"
              >
                Clone & launch
              </Link>
              <Link
                href={`/app/campaigns/new?template=${template.id}`}
                className="rounded-md border border-[var(--altus-border)] px-3 py-2 text-xs font-semibold text-[var(--altus-text)]"
              >
                Customize
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

import Link from "next/link";
import { VerticalCampaignWizard } from "@/components/campaigns/VerticalCampaignWizard";

type SearchParams = Promise<{ owner?: string }>;

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ownerType =
    params.owner === "platform"
      ? "ALTUS_PLATFORM_CAMPAIGN"
      : "SUBSCRIBER_CAMPAIGN";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
            Create campaign
          </h1>
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            Guided setup for audience, strategy, territory, channels, and lead experience.
          </p>
        </div>
        <Link href="/app/campaigns" className="text-sm font-semibold text-[var(--altus-blue)]">
          ← Campaigns
        </Link>
      </div>
      <VerticalCampaignWizard
        ownerType={ownerType}
        eligibleTerritories={["FL", "TX", "CA", "GA", "NY"]}
      />
    </div>
  );
}

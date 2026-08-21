import { CampaignBuilder } from "@/components/campaigns/CampaignBuilder";
import type { CampaignOwnerType } from "@/domain/types/campaign-engine";

type SearchParams = Promise<{ template?: string; owner?: string }>;

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ownerType =
    params.owner === "platform"
      ? ("ALTUS_PLATFORM_CAMPAIGN" as CampaignOwnerType)
      : ("SUBSCRIBER_CAMPAIGN" as CampaignOwnerType);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Create campaign
        </h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          10-step wizard · Goal → Audience → Strategy → Territory → Channels →
          Budget → Lead Experience → Distribution → Review → Launch
        </p>
      </div>
      <CampaignBuilder templateId={params.template} ownerType={ownerType} />
    </div>
  );
}

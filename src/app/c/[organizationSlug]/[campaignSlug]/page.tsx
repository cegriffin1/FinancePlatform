import { notFound } from "next/navigation";
import { PublicCampaignExperience } from "@/components/campaigns/PublicCampaignExperience";
import {
  findCampaignBySlug,
  getSimStore,
} from "@/application/growth/simulationStore";
import { recordCampaignView } from "@/application/growth/campaignService";

type Params = Promise<{ organizationSlug: string; campaignSlug: string }>;

export default async function PublicCampaignPage({
  params,
}: {
  params: Params;
}) {
  const { organizationSlug, campaignSlug } = await params;
  // Ensure store exists in this process
  getSimStore();
  const campaign = findCampaignBySlug(organizationSlug, campaignSlug);
  if (!campaign) notFound();

  recordCampaignView(organizationSlug, campaignSlug);

  return (
    <PublicCampaignExperience
      organizationSlug={organizationSlug}
      campaignSlug={campaignSlug}
      headline={campaign.landing_headline}
      support={campaign.landing_support}
      cta={campaign.branding.custom_cta ?? "Start My Assessment"}
      thankYou={
        campaign.branding.thank_you_message ??
        "Thanks — an advisor will follow up shortly."
      }
      strategy={campaign.strategy}
      brandingName={campaign.branding.organization_name ?? "ALTUS"}
      assessmentTemplateKey={
        campaign.qualification_template_key ??
        campaign.assessment_template_key ??
        "retirement-opportunity-v1"
      }
    />
  );
}

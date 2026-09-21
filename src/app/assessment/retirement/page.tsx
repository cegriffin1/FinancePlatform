import {
  ensureDirectRetirementCampaign,
  DIRECT_RETIREMENT_ORG_SLUG,
  DIRECT_RETIREMENT_CAMPAIGN_SLUG,
} from "@/application/growth/campaignService";
import { getSimStore } from "@/application/growth/simulationStore";
import { PublicCampaignExperience } from "@/components/campaigns/PublicCampaignExperience";

/**
 * Direct homepage entry to the Retirement Opportunity Assessment.
 * Same engine/session/lead pipeline as campaign traffic.
 * Attribution: DIRECT_ASSESSMENT
 */
export default function DirectRetirementAssessmentPage() {
  getSimStore();
  const campaign = ensureDirectRetirementCampaign();

  return (
    <PublicCampaignExperience
      organizationSlug={DIRECT_RETIREMENT_ORG_SLUG}
      campaignSlug={DIRECT_RETIREMENT_CAMPAIGN_SLUG}
      headline="Build Your Retirement Profile"
      support="Answer a few questions about your retirement, financial priorities and goals."
      cta="Start Assessment"
      thankYou={
        campaign.branding.thank_you_message ??
        "Thanks — your retirement profile is ready."
      }
      strategy="Retirement"
      brandingName="ALTUS"
      assessmentTemplateKey="retirement-opportunity-v1"
      trafficSource="DIRECT_ASSESSMENT"
      forceRetirement
    />
  );
}

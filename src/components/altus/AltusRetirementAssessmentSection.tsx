import { AltusContainer } from "@/components/altus/AltusContainer";
import { RetirementAssessmentExperience } from "@/components/assessment/RetirementAssessmentExperience";
import {
  ensureDirectRetirementCampaign,
  DIRECT_RETIREMENT_ORG_SLUG,
  DIRECT_RETIREMENT_CAMPAIGN_SLUG,
} from "@/application/growth/campaignService";
import { getSimStore } from "@/application/growth/simulationStore";

/**
 * Homepage-embedded Retirement Opportunity Assessment.
 * Start Assessment → Q1 appears in this same section (no route change).
 */
export function AltusRetirementAssessmentSection() {
  getSimStore();
  const campaign = ensureDirectRetirementCampaign();

  return (
    <section
      id="retirement-assessment"
      className="scroll-mt-20 border-y border-[var(--altus-border)] bg-[linear-gradient(180deg,#f4f7fb_0%,#eef3f9_55%,#ffffff_100%)] py-12 md:py-16"
      aria-label="Retirement Opportunity Assessment"
    >
      <AltusContainer>
        <div className="mb-8 max-w-2xl">
          <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
            RETIREMENT OPPORTUNITY ASSESSMENT
          </p>
          <h2 className="mt-2 text-[1.75rem] font-bold tracking-tight text-[var(--altus-text)] md:text-[2rem]">
            Build Your Retirement Profile
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[var(--altus-text-secondary)]">
            Discover how your retirement goals, timeline and priorities fit
            together. Start below — stay in this section through your result.
          </p>
        </div>

        <RetirementAssessmentExperience
          organizationSlug={DIRECT_RETIREMENT_ORG_SLUG}
          campaignSlug={DIRECT_RETIREMENT_CAMPAIGN_SLUG}
          thankYou={
            campaign.branding.thank_you_message ??
            "Thanks — your retirement profile is ready."
          }
          brandingName="ALTUS"
          trafficSource="DIRECT_ASSESSMENT"
          embedded
        />
      </AltusContainer>
    </section>
  );
}

import { StubLeadScoringService } from "@/infrastructure/providers/StubLeadScoringService";
import { StubLeadRoutingService } from "@/infrastructure/providers/StubLeadRoutingService";
import {
  StubAnalyticsProvider,
  StubCalendarProvider,
  StubCommunicationProvider,
  StubContactCenterProvider,
  StubCRMProvider,
} from "@/infrastructure/providers/stubs";
import {
  StubAdvancedMarketsModule,
  StubBillingProvider,
  StubLeadLifecyclePolicyService,
  StubLeadNurtureService,
  StubTerritoryEligibilityService,
} from "@/infrastructure/providers/growthStubs";
import { ConfigurableLeadClassificationService } from "@/application/classification/ConfigurableLeadClassificationService";
import { ConfigurableLeadDistributionService } from "@/application/distribution/ConfigurableLeadDistributionService";
import { InMemorySubscriptionEntitlementService } from "@/application/entitlements/InMemorySubscriptionEntitlementService";
import { SOCIAL_CHANNEL_PROVIDERS } from "@/infrastructure/providers/channels/mockChannelProviders";
import { CampaignPublishingService } from "@/application/integrations/CampaignPublishingService";
import { CampaignMetricsSyncService } from "@/application/integrations/CampaignMetricsSyncService";
import { ensureIntegrationJobHandlers } from "@/application/integrations/registerJobs";

/** Composition root — swap implementations without UI changes. */
export function createProviderContainer() {
  ensureIntegrationJobHandlers();
  return {
    leadScoring: new StubLeadScoringService(),
    leadRouting: new StubLeadRoutingService(),
    leadClassification: new ConfigurableLeadClassificationService(),
    leadDistribution: new ConfigurableLeadDistributionService(),
    subscriptionEntitlements: new InMemorySubscriptionEntitlementService(),
    territoryEligibility: new StubTerritoryEligibilityService(),
    leadLifecyclePolicy: new StubLeadLifecyclePolicyService(),
    leadNurture: new StubLeadNurtureService(),
    communication: new StubCommunicationProvider(),
    calendar: new StubCalendarProvider(),
    crm: new StubCRMProvider(),
    contactCenter: new StubContactCenterProvider(),
    analytics: new StubAnalyticsProvider(),
    billing: new StubBillingProvider(),
    advancedMarkets: new StubAdvancedMarketsModule(),
    channelProviders: SOCIAL_CHANNEL_PROVIDERS,
    campaignPublishing: new CampaignPublishingService(),
    campaignMetricsSync: new CampaignMetricsSyncService(),
  };
}

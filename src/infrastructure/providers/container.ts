import { StubLeadScoringService } from "@/infrastructure/providers/StubLeadScoringService";
import { StubLeadRoutingService } from "@/infrastructure/providers/StubLeadRoutingService";
import {
  StubAnalyticsProvider,
  StubCalendarProvider,
  StubCommunicationProvider,
  StubContactCenterProvider,
  StubCRMProvider,
} from "@/infrastructure/providers/stubs";

/** Composition root for provider stubs — swap implementations without UI changes. */
export function createProviderContainer() {
  return {
    leadScoring: new StubLeadScoringService(),
    leadRouting: new StubLeadRoutingService(),
    communication: new StubCommunicationProvider(),
    calendar: new StubCalendarProvider(),
    crm: new StubCRMProvider(),
    contactCenter: new StubContactCenterProvider(),
    analytics: new StubAnalyticsProvider(),
  };
}

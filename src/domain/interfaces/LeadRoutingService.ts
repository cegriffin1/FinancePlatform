import type { Lead, LeadTemperatureKey } from "@/domain/types";
import type { UUID } from "@/domain/types/base";

export type LeadRoutingResult = {
  assignedTo: UUID | null;
  teamId: UUID | null;
  strategy:
    | "owner"
    | "round_robin"
    | "manager_review"
    | "territory_match"
    | "specialization"
    | "capacity"
    | "unassigned"
    | "hold";
  reason: string;
  eligibilityNotes: string[];
};

export type LeadRoutingContext = {
  organizationId: UUID;
  temperatureKey?: LeadTemperatureKey | null;
  strategyCategories?: string[];
  territoryCode?: string | null;
  campaignId?: UUID | null;
  requireLicenseTypes?: string[];
};

/**
 * Configurable routing. Must respect territory/licensing eligibility.
 */
export interface LeadRoutingService {
  route(lead: Lead, context: LeadRoutingContext): Promise<LeadRoutingResult>;
}

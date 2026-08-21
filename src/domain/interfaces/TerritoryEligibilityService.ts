import type { UUID } from "@/domain/types/base";

export type TerritoryEligibilityInput = {
  organizationId: UUID;
  memberId: UUID;
  territoryCode: string;
  requiredLicenseTypes?: string[];
};

export type TerritoryEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

/**
 * Eligibility inputs only — does not determine regulatory fitness.
 */
export interface TerritoryEligibilityService {
  evaluate(input: TerritoryEligibilityInput): Promise<TerritoryEligibilityResult>;
}

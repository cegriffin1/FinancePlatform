import type { Opportunity, UUID } from "@/domain/types";

export interface OpportunityRepository {
  list(organizationId: UUID): Promise<Opportunity[]>;
  getById(
    organizationId: UUID,
    opportunityId: UUID,
  ): Promise<Opportunity | null>;
  create(
    input: Omit<Opportunity, "id" | "created_at" | "updated_at">,
  ): Promise<Opportunity>;
  updateStage(
    organizationId: UUID,
    opportunityId: UUID,
    stageId: UUID,
    updatedBy: UUID,
  ): Promise<Opportunity>;
}

import type { Campaign, UUID } from "@/domain/types";

export interface CampaignRepository {
  list(organizationId: UUID): Promise<Campaign[]>;
  getById(organizationId: UUID, campaignId: UUID): Promise<Campaign | null>;
  create(
    input: Omit<Campaign, "id" | "created_at" | "updated_at">,
  ): Promise<Campaign>;
  update(
    organizationId: UUID,
    campaignId: UUID,
    patch: Partial<Pick<Campaign, "name" | "description" | "status">>,
    updatedBy: UUID,
  ): Promise<Campaign>;
}

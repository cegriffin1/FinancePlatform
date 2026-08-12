import type { Lead, UUID } from "@/domain/types";

export interface LeadRepository {
  list(organizationId: UUID): Promise<Lead[]>;
  getById(organizationId: UUID, leadId: UUID): Promise<Lead | null>;
  create(input: Omit<Lead, "id" | "created_at" | "updated_at">): Promise<Lead>;
  update(
    organizationId: UUID,
    leadId: UUID,
    patch: Partial<
      Pick<Lead, "status" | "score" | "assigned_to" | "team_id" | "contact_id">
    >,
    updatedBy: UUID,
  ): Promise<Lead>;
  listAssignedTo(organizationId: UUID, memberId: UUID): Promise<Lead[]>;
}

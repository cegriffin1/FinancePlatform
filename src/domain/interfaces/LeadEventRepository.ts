import type { LeadEvent, LeadProvenance } from "@/domain/types";
import type { UUID } from "@/domain/types/base";

export interface LeadEventRepository {
  append(
    event: Omit<LeadEvent, "id" | "created_at">,
  ): Promise<LeadEvent>;
  listForLead(organizationId: UUID, leadId: UUID): Promise<LeadEvent[]>;
  getProvenance(
    organizationId: UUID,
    leadId: UUID,
  ): Promise<LeadProvenance | null>;
  createProvenance(input: LeadProvenance): Promise<LeadProvenance>;
}

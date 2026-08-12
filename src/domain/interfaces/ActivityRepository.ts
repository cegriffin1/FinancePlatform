import type { Activity, UUID } from "@/domain/types";

export interface ActivityRepository {
  listForLead(organizationId: UUID, leadId: UUID): Promise<Activity[]>;
  create(
    input: Omit<Activity, "id" | "created_at" | "updated_at">,
  ): Promise<Activity>;
}

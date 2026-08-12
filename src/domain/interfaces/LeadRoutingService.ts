import type { Lead, UUID } from "@/domain/types";

export type LeadRoutingResult = {
  assignedTo: UUID | null;
  teamId: UUID | null;
  strategy: "owner" | "round_robin" | "manager_review" | "unassigned";
  reason: string;
};

export interface LeadRoutingService {
  route(lead: Lead, organizationId: UUID): Promise<LeadRoutingResult>;
}

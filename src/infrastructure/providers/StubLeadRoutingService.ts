import type {
  LeadRoutingContext,
  LeadRoutingResult,
  LeadRoutingService,
} from "@/domain/interfaces/LeadRoutingService";
import type { Lead } from "@/domain/types";

/** Stub router — keeps leads unassigned until routing policies ship. */
export class StubLeadRoutingService implements LeadRoutingService {
  async route(lead: Lead, context: LeadRoutingContext): Promise<LeadRoutingResult> {
    void context;
    return {
      assignedTo: lead.assigned_to,
      teamId: lead.team_id,
      strategy: lead.assigned_to ? "owner" : "unassigned",
      reason: "stub-routing",
      eligibilityNotes: [],
    };
  }
}

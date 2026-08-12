import type { LeadRoutingService } from "@/domain/interfaces/LeadRoutingService";
import type { Lead } from "@/domain/types";

/** Stub router — keeps leads unassigned until routing rules ship. */
export class StubLeadRoutingService implements LeadRoutingService {
  async route(lead: Lead) {
    return {
      assignedTo: lead.assigned_to,
      teamId: lead.team_id,
      strategy: lead.assigned_to ? ("owner" as const) : ("unassigned" as const),
      reason: "stub-routing",
    };
  }
}

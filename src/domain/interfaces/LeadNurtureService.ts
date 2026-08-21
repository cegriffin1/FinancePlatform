import type { Lead, LeadLifecycleStatus } from "@/domain/types";
import type { UUID } from "@/domain/types/base";

export type NurtureEnrollment = {
  id: UUID;
  organization_id: UUID;
  lead_id: UUID;
  sequence_key: string;
  status: "active" | "paused" | "completed" | "cancelled";
  enrolled_at: string;
};

export interface LeadNurtureService {
  enroll(
    lead: Lead,
    sequenceKey: string,
    organizationId: UUID,
  ): Promise<NurtureEnrollment>;
  suggestLifecycleTransition(
    lead: Lead,
  ): Promise<LeadLifecycleStatus | null>;
}

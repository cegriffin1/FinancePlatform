import type { Contact, Lead, Opportunity, UUID } from "@/domain/types";

/**
 * CRMProvider abstracts an external CRM system of record (e.g. Dynamics 365 Sales).
 * Supabase repositories remain the default local persistence for v1.
 */
export interface CRMProvider {
  syncContact(organizationId: UUID, contact: Contact): Promise<{ externalId: string }>;
  syncLead(organizationId: UUID, lead: Lead): Promise<{ externalId: string }>;
  syncOpportunity(
    organizationId: UUID,
    opportunity: Opportunity,
  ): Promise<{ externalId: string }>;
}

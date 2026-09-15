import type { Contact, Lead, Opportunity, UUID } from "@/domain/types";
import type { CRMProvider } from "@/domain/interfaces/CRMProvider";
import type { SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { randomUUID } from "crypto";

/**
 * Native ALTUS CRM — primary MVP system of record for retirement leads.
 * Does not require Dynamics 365 licensing.
 */
export class AltusCRMProvider implements CRMProvider {
  readonly name = "altus";

  async syncContact(organizationId: UUID, contact: Contact) {
    return this.log(organizationId, "contact", contact.id, { contact });
  }

  async syncLead(organizationId: UUID, lead: Lead) {
    return this.log(organizationId, "lead", lead.id, { lead });
  }

  async syncOpportunity(organizationId: UUID, opportunity: Opportunity) {
    return this.log(organizationId, "opportunity", opportunity.id, { opportunity });
  }

  /** Sync a simulation lead into ALTUS CRM event log (local). */
  async syncSimLead(lead: SimLead) {
    const orgId =
      lead.assigned_organization_id ??
      lead.organization_id ??
      getSimStore().organizations[0]!.id;
    return this.log(orgId, "sim_lead", lead.id, {
      lead_id: lead.id,
      pipeline_stage: lead.pipeline_stage,
      outcome: lead.outcome,
      ownership: lead.ownership,
      score: lead.score,
    });
  }

  private async log(
    organizationId: UUID,
    entity: string,
    id: string | undefined,
    payload: Record<string, unknown>,
  ) {
    const store = getSimStore();
    const externalId = `altus-${entity}-${id ?? randomUUID()}`;
    store.crm_sync_log.push({
      id: randomUUID(),
      provider: "altus",
      organization_id: organizationId,
      entity,
      external_id: externalId,
      payload,
      created_at: new Date().toISOString(),
    });
    return { externalId };
  }
}

/**
 * Dynamics 365 placeholder — not required to run the MVP.
 * Keep interface ready; methods throw until licensed integration is configured.
 */
export class Dynamics365CRMProvider implements CRMProvider {
  readonly name = "dynamics365";

  async syncContact(_organizationId: UUID, _contact: Contact): Promise<{ externalId: string }> {
    void _organizationId;
    void _contact;
    throw new Error(
      "Dynamics365CRMProvider is not configured. ALTUS CRM runs independently without D365 licensing.",
    );
  }

  async syncLead(_organizationId: UUID, _lead: Lead): Promise<{ externalId: string }> {
    void _organizationId;
    void _lead;
    throw new Error(
      "Dynamics365CRMProvider is not configured. ALTUS CRM runs independently without D365 licensing.",
    );
  }

  async syncOpportunity(
    _organizationId: UUID,
    _opportunity: Opportunity,
  ): Promise<{ externalId: string }> {
    void _organizationId;
    void _opportunity;
    throw new Error(
      "Dynamics365CRMProvider is not configured. ALTUS CRM runs independently without D365 licensing.",
    );
  }
}

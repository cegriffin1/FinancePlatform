import {
  DEFAULT_INVENTORY_CONFIG,
  DEFAULT_PRICING_CONFIG,
  type ComplianceGateResult,
  type LeadComplianceProfile,
  defaultCompliance,
} from "@/domain/types/lead-inventory";
import type { SimLead } from "@/application/growth/simulationStore";
import { getSimStore } from "@/application/growth/simulationStore";
import { randomUUID } from "crypto";

function nowIso() {
  return new Date().toISOString();
}

function daysBetween(fromIso: string, to = Date.now()) {
  return Math.floor((to - new Date(fromIso).getTime()) / (24 * 60 * 60 * 1000));
}

function appendEvent(lead: SimLead, type: string, payload: Record<string, unknown> = {}) {
  const store = getSimStore();
  store.events.push({
    id: randomUUID(),
    organization_id:
      lead.assigned_organization_id ??
      lead.organization_id ??
      store.organizations[0]!.id,
    lead_id: lead.id,
    event_type: type,
    occurred_at: nowIso(),
    actor_profile_id: null,
    payload,
    created_at: nowIso(),
  });
}

export class LeadComplianceService {
  ensure(lead: SimLead): LeadComplianceProfile {
    if (!lead.compliance) {
      lead.compliance = defaultCompliance({
        consent: lead.consent,
        state: lead.state,
        capturedAt: lead.created_at,
      });
    }
    return lead.compliance;
  }

  suppress(lead: SimLead, reason: string) {
    const c = this.ensure(lead);
    c.suppressed = true;
    c.suppression_reason = reason;
    c.resale_permitted = false;
    lead.inventory_status = "SUPPRESSED";
    appendEvent(lead, "lead_suppressed", { reason });
    lead.updated_at = nowIso();
    return c;
  }

  revokeSharing(lead: SimLead, note?: string) {
    const c = this.ensure(lead);
    c.data_sharing_permitted = false;
    c.resale_permitted = false;
    c.sharing_permissions_note = note ?? "Sharing permission revoked";
    if (
      lead.inventory_status === "MARKETPLACE" ||
      lead.inventory_status === "MARKETPLACE_ELIGIBLE"
    ) {
      lead.inventory_status = "NOT_ELIGIBLE_FOR_RESALE";
      lead.marketplace_listed = false;
    }
    appendEvent(lead, "sharing_permission_revoked", { note: note ?? null });
    lead.updated_at = nowIso();
    return c;
  }

  /**
   * Never make a lead purchasable when consent/permissions do not permit it.
   */
  evaluateMarketplaceEligibility(lead: SimLead): ComplianceGateResult {
    const c = this.ensure(lead);
    const reasons: string[] = [];
    if (!c.contact_consent) reasons.push("Missing contact consent");
    if (!c.data_sharing_permitted) reasons.push("Data sharing not permitted");
    if (!c.resale_permitted) reasons.push("Resale not permitted");
    if (c.suppressed) reasons.push(`Suppressed: ${c.suppression_reason ?? "policy"}`);
    if (c.restricted_jurisdictions.includes(c.jurisdiction)) {
      reasons.push(`Jurisdiction ${c.jurisdiction} restricts resale`);
    }
    if (!c.consent_basis || c.consent_basis === "none") {
      reasons.push("No valid consent basis on file");
    }
    const ageDays = daysBetween(lead.created_at);
    if (ageDays > c.retention_policy_days) {
      reasons.push("Beyond retention policy");
    }
    return { eligible: reasons.length === 0, reasons };
  }
}

export { DEFAULT_INVENTORY_CONFIG, DEFAULT_PRICING_CONFIG };

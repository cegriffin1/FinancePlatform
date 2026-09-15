import { randomUUID } from "crypto";
import {
  getSimStore,
  type SimLead,
} from "@/application/growth/simulationStore";
import { applyLeadIntelligence } from "@/application/intelligence/orchestrate";
import { AltusCRMProvider } from "@/infrastructure/providers/AltusCRMProvider";

export const PENDING_FLAGS = [
  "SCORING_PENDING",
  "DISTRIBUTION_PENDING",
  "NOTIFICATION_PENDING",
  "CRM_SYNC_PENDING",
] as const;
export type PendingFlag = (typeof PENDING_FLAGS)[number];

/**
 * Safe retries for downstream failures.
 * Captured leads remain in the store; retries never drop them.
 */
export class LeadPendingRecoveryService {
  listPending(leads: SimLead[] = getSimStore().leads) {
    return {
      SCORING_PENDING: leads.filter(
        (l) => l.processing_flags?.scoring_pending || l.status === "scoring_pending",
      ),
      DISTRIBUTION_PENDING: leads.filter(
        (l) =>
          l.processing_flags?.distribution_pending ||
          l.status === "distribution_pending",
      ),
      NOTIFICATION_PENDING: leads.filter(
        (l) => l.processing_flags?.notification_pending,
      ),
      CRM_SYNC_PENDING: leads.filter(
        (l) => l.processing_flags?.crm_sync_pending,
      ),
    };
  }

  async reprocessLead(lead: SimLead): Promise<{
    lead: SimLead;
    retried: PendingFlag[];
    errors: string[];
  }> {
    const store = getSimStore();
    const campaign = store.campaigns.find((c) => c.id === lead.campaign_id);
    const retried: PendingFlag[] = [];
    const errors: string[] = [];

    if (lead.processing_flags?.scoring_pending || lead.status === "scoring_pending") {
      retried.push("SCORING_PENDING");
      try {
        if (!campaign) throw new Error("Campaign missing for scoring retry");
        await applyLeadIntelligence({
          lead,
          campaign,
          appointmentRequested: Boolean(
            lead.appointments?.length ||
              lead.assessment_answers.decision_timeline,
          ),
        });
        lead.processing_flags = {
          ...lead.processing_flags,
          scoring_pending: false,
        };
        if (lead.status === "scoring_pending") lead.status = "new";
        this.pushEvent(lead, "scoring_retry_succeeded", {});
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "scoring retry failed");
        lead.processing_flags = {
          ...lead.processing_flags,
          scoring_pending: true,
        };
        this.pushEvent(lead, "scoring_retry_failed", { error: errors.at(-1) });
      }
    }

    if (
      lead.processing_flags?.distribution_pending ||
      lead.status === "distribution_pending"
    ) {
      retried.push("DISTRIBUTION_PENDING");
      try {
        if (!campaign) throw new Error("Campaign missing for distribution retry");
        // Re-entry: if still unassigned, mark for operator attention but keep lead
        if (!lead.assigned_organization_id) {
          lead.distribution_status = "unassigned_pool";
          lead.status = "unassigned_pool";
        } else {
          lead.status = "qualified";
        }
        lead.processing_flags = {
          ...lead.processing_flags,
          distribution_pending: false,
        };
        this.pushEvent(lead, "distribution_retry_succeeded", {
          assigned_organization_id: lead.assigned_organization_id,
        });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "distribution retry failed");
        lead.processing_flags = {
          ...lead.processing_flags,
          distribution_pending: true,
        };
      }
    }

    if (lead.processing_flags?.notification_pending) {
      retried.push("NOTIFICATION_PENDING");
      try {
        const orgId = lead.assigned_organization_id ?? lead.organization_id;
        if (!orgId) throw new Error("No organization for notification");
        store.notifications.unshift({
          id: randomUUID(),
          organization_id: orgId,
          lead_id: lead.id,
          title: "Lead ready (retry)",
          body: `${lead.first_name} ${lead.last_name} · Score ${lead.score}`,
          created_at: new Date().toISOString(),
          read: false,
        });
        lead.processing_flags = {
          ...lead.processing_flags,
          notification_pending: false,
        };
        this.pushEvent(lead, "notification_retry_succeeded", {});
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "notification retry failed");
      }
    }

    if (lead.processing_flags?.crm_sync_pending) {
      retried.push("CRM_SYNC_PENDING");
      try {
        await new AltusCRMProvider().syncSimLead(lead);
        lead.processing_flags = {
          ...lead.processing_flags,
          crm_sync_pending: false,
        };
        this.pushEvent(lead, "crm_sync_retry_succeeded", {});
      } catch (e) {
        errors.push(e instanceof Error ? e.message : "crm sync retry failed");
        lead.processing_flags = {
          ...lead.processing_flags,
          crm_sync_pending: true,
        };
      }
    }

    lead.updated_at = new Date().toISOString();
    return { lead, retried, errors };
  }

  async reprocessAll() {
    const pending = this.listPending();
    const ids = new Set(
      [
        ...pending.SCORING_PENDING,
        ...pending.DISTRIBUTION_PENDING,
        ...pending.NOTIFICATION_PENDING,
        ...pending.CRM_SYNC_PENDING,
      ].map((l) => l.id),
    );
    const results = [];
    for (const id of ids) {
      const lead = getSimStore().leads.find((l) => l.id === id);
      if (lead) results.push(await this.reprocessLead(lead));
    }
    return results;
  }

  private pushEvent(lead: SimLead, type: string, payload: Record<string, unknown>) {
    getSimStore().events.push({
      id: randomUUID(),
      organization_id:
        lead.assigned_organization_id ??
        lead.organization_id ??
        getSimStore().organizations[0]!.id,
      lead_id: lead.id,
      event_type: type,
      occurred_at: new Date().toISOString(),
      actor_profile_id: null,
      payload,
      created_at: new Date().toISOString(),
    });
  }
}

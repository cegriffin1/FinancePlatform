/**
 * Dual-mode prospect persistence facade.
 * simulation → AssessmentSessionService + sim store
 * supabase → SupabaseAssessmentSessionRepository (+ durable lead writer)
 */

import { AssessmentSessionService } from "@/application/growth/AssessmentSessionService";
import type { AssessmentAttributionInput } from "@/application/growth/AssessmentSessionService";
import {
  getSimStore,
  type AssessmentSession,
  type SimLead,
} from "@/application/growth/simulationStore";
import { SupabaseAssessmentSessionRepository } from "@/infrastructure/supabase/repositories/SupabaseAssessmentSessionRepository";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import { isSupabaseDataMode, DataModeError } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";
import { RETIREMENT_OPPORTUNITY_V1 } from "@/application/retirement/assessmentDefinition";

export class DurableProspectService {
  private readonly sim = new AssessmentSessionService();
  private readonly supabase = new SupabaseAssessmentSessionRepository();

  async resolveCampaign(organizationSlug: string, campaignSlug: string) {
    if (isSupabaseDataMode()) {
      return this.supabase.findCampaignBySlug(organizationSlug, campaignSlug);
    }
    const store = getSimStore();
    const campaign = store.campaigns.find(
      (c) =>
        c.organization_slug === organizationSlug && c.slug === campaignSlug,
    );
    return campaign ?? null;
  }

  async createSession(input: {
    campaign_id: string;
    organization_id: string;
    organization_slug: string;
    campaign_slug: string;
    assessment_definition_id?: string;
    assessment_version?: string;
    attribution: AssessmentAttributionInput;
  }): Promise<AssessmentSession> {
    if (isSupabaseDataMode()) {
      return this.supabase.create({
        ...input,
        assessment_definition_id:
          input.assessment_definition_id ?? RETIREMENT_OPPORTUNITY_V1.key,
        assessment_version:
          input.assessment_version ?? RETIREMENT_OPPORTUNITY_V1.version,
      });
    }
    return this.sim.create(input);
  }

  async getAuthorized(
    sessionId: string,
    resumeToken: string,
  ): Promise<AssessmentSession | null> {
    if (isSupabaseDataMode()) {
      return this.supabase.getByIdAndToken(sessionId, resumeToken);
    }
    return this.sim.getAuthorized(sessionId, resumeToken);
  }

  async getByResumeToken(resumeToken: string) {
    if (isSupabaseDataMode()) {
      return this.supabase.getByResumeToken(resumeToken);
    }
    return this.sim.getByResumeToken(resumeToken);
  }

  async markStarted(session: AssessmentSession) {
    if (isSupabaseDataMode()) {
      if (!session.started_at) {
        session.started_at = new Date().toISOString();
        await this.supabase.track(session, "assessment_started", {});
      }
      return this.supabase.update(session);
    }
    return this.sim.markStarted(session.id);
  }

  async persistAnswer(
    session: AssessmentSession,
    questionId: string,
    value: string,
    stage?: string | null,
  ) {
    if (isSupabaseDataMode()) {
      if (session.status === "completed") return session;
      const previous = session.answers[questionId];
      session.answers = { ...session.answers, [questionId]: value };
      session.last_completed_question = questionId;
      if (stage) session.last_completed_stage = stage;
      const { ProfileCompletenessService } = await import(
        "@/application/retirement/ProfileCompletenessService"
      );
      session.completion_percentage = new ProfileCompletenessService().calculate(
        session.answers,
      ).profile_completion_percentage;
      if (questionId === "primary_objective") {
        session.branch =
          value === "BALANCE"
            ? "BOTH"
            : value === "INCOME"
              ? "INCOME"
              : value === "GROW" || value === "PROTECT"
                ? "ACCUMULATION"
                : value;
      }
      await this.supabase.upsertAnswer(session, questionId, value, stage);
      if (previous !== value) {
        await this.supabase.track(session, "question_answered", {
          question_id: questionId,
          stage: stage ?? null,
        });
      }
      return this.supabase.update(session);
    }
    return this.sim.persistAnswer(session.id, questionId, value, stage);
  }

  async markContactStarted(session: AssessmentSession) {
    if (isSupabaseDataMode()) {
      await this.supabase.track(session, "contact_started", {});
      return this.supabase.update(session);
    }
    return this.sim.markContactStarted(session.id);
  }

  async markAbandoned(session: AssessmentSession) {
    if (isSupabaseDataMode()) {
      if (session.status === "completed") return session;
      session.status = "abandoned";
      session.abandoned_at = new Date().toISOString();
      await this.supabase.track(session, "assessment_abandoned", {
        last_completed_question: session.last_completed_question,
        completion_percentage: session.completion_percentage,
      });
      return this.supabase.update(session);
    }
    return this.sim.markAbandoned(session.id);
  }

  async markCompleted(session: AssessmentSession, leadId: string) {
    if (isSupabaseDataMode()) {
      session.status = "completed";
      session.lead_id = leadId;
      session.contactable = true;
      session.completion_percentage = 100;
      session.contact_captured_at = new Date().toISOString();
      await this.supabase.track(session, "contact_submitted", { lead_id: leadId });
      await this.supabase.track(session, "assessment_completed", {
        lead_id: leadId,
      });
      return this.supabase.update(session);
    }
    return this.sim.markCompleted(session.id, leadId);
  }

  /**
   * Persist a lead created by the existing scoring pipeline into Supabase.
   * Idempotent on assessment_session_id.
   */
  async persistLeadFromSim(lead: SimLead, session: AssessmentSession) {
    if (!isSupabaseDataMode()) return lead.id;

    let supabase;
    try {
      supabase = createSupabaseServiceClient();
    } catch (e) {
      logAltusError("DATABASE_ERROR", "Cannot persist lead — service role missing", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      throw new DataModeError("Unable to persist lead.");
    }

    // Idempotency: return existing lead for this session
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("assessment_session_id", session.id)
      .maybeSingle();
    if (existing?.id) {
      return existing.id as string;
    }

    // Sim store may carry placeholder org/campaign UUIDs — only persist IDs
    // that exist in Supabase. Prefer assignee, then session host org.
    const orgCandidates = [
      lead.organization_id,
      lead.assigned_organization_id,
      session.organization_id,
    ];
    let orgId: string | null = null;
    for (const candidate of orgCandidates) {
      if (!candidate) continue;
      const { data: orgRow } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", candidate)
        .maybeSingle();
      if (orgRow?.id) {
        orgId = orgRow.id as string;
        break;
      }
    }
    if (!orgId) {
      throw new DataModeError("Lead missing organization_id.");
    }

    let campaignId: string | null = lead.campaign_id ?? session.campaign_id ?? null;
    if (campaignId) {
      const { data: campRow } = await supabase
        .from("campaigns")
        .select("id")
        .eq("id", campaignId)
        .maybeSingle();
      if (!campRow?.id) {
        campaignId = session.campaign_id ?? null;
        if (campaignId) {
          const { data: sessionCamp } = await supabase
            .from("campaigns")
            .select("id")
            .eq("id", campaignId)
            .maybeSingle();
          if (!sessionCamp?.id) campaignId = null;
        }
      }
    }

    const now = new Date().toISOString();
    const opportunityScore =
      lead.qualification?.opportunity.opportunity_score ?? lead.score;

    // Contact first
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        email: lead.email,
        phone: lead.phone,
        full_name: `${lead.first_name} ${lead.last_name}`.trim(),
        company_name: lead.business_name,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (contactErr) {
      logAltusError("LEAD_CREATION_ERROR", "Contact insert failed", {
        message: contactErr.message,
      });
      // Continue — lead can still be stored with denormalized contact fields
    }

    const { data: inserted, error: leadErr } = await supabase
      .from("leads")
      .insert({
        id: lead.id,
        organization_id: orgId,
        campaign_id: campaignId,
        contact_id: contact?.id ?? null,
        assessment_session_id: session.id,
        status: lead.status === "new" ? "new" : "qualified",
        score: lead.score,
        opportunity_score: opportunityScore,
        score_classification:
          lead.qualification?.opportunity.classification ?? null,
        score_explanation: lead.qualification?.opportunity.explanation ?? null,
        temperature_key: lead.temperature_key,
        operational_temperature: lead.operational_temperature ?? null,
        fit_score: lead.fit_score,
        intent_score: lead.intent_score,
        engagement_score: lead.engagement_score,
        score_version: lead.score_version,
        consent_captured: true,
        territory: lead.state,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        preferred_contact: lead.preferred_contact,
        attribution: lead.attribution,
        assessment_answers: lead.assessment_answers,
        last_meaningful_interaction_at:
          lead.last_meaningful_interaction_at ?? now,
        last_activity_at: lead.last_activity_at ?? now,
        qualified_at: lead.scored_at ?? now,
        assignment_reason: lead.assignment_reason ?? null,
        assignment_method: lead.distribution?.distribution_method ?? null,
        source: "assessment",
        created_at: lead.created_at ?? now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (leadErr) {
      // Unique violation → already created
      if (leadErr.code === "23505") {
        const { data: again } = await supabase
          .from("leads")
          .select("id")
          .eq("assessment_session_id", session.id)
          .maybeSingle();
        if (again?.id) return again.id as string;
      }
      logAltusError("LEAD_CREATION_ERROR", "Lead insert failed", {
        message: leadErr.message,
        code: leadErr.code,
      });
      throw new DataModeError("Unable to create lead.");
    }

    const leadId = inserted!.id as string;

    // Score snapshot (best-effort — must not erase lead)
    try {
      const opp = lead.qualification?.opportunity;
      if (opp) {
        const { data: scoreRow } = await supabase
          .from("lead_scores")
          .insert({
            lead_id: leadId,
            organization_id: orgId,
            total_score: opp.opportunity_score,
            fit_score: opp.opportunity_size,
            intent_score: opp.intent_timing,
            engagement_score: opp.engagement_quality,
            scoring_version: opp.score_version,
            classification: opp.classification,
            explanation: opp.explanation,
          })
          .select("id")
          .single();

        if (scoreRow?.id && opp.factors?.length) {
          const mapped = opp.factors
            .map((f) => {
              const category =
                f.dimension === "opportunity_size"
                  ? "fit"
                  : f.dimension === "intent_timing" ||
                      f.dimension === "retirement_need"
                    ? "intent"
                    : "engagement";
              return {
                organization_id: orgId,
                lead_score_id: scoreRow.id,
                key: f.key,
                category,
                points: f.points,
                reason: f.reason,
              };
            });
          if (mapped.length) {
            await supabase.from("lead_score_factors").insert(mapped);
          }
        }

        await supabase.from("lead_score_snapshots").insert({
          lead_id: leadId,
          organization_id: orgId,
          profile: opp,
        });
      }
    } catch (e) {
      logAltusError("SCORING_ERROR", "Score persistence failed after lead create", {
        leadId,
        reason: e instanceof Error ? e.message : "unknown",
      });
    }

    // Temperature snapshot (best-effort)
    try {
      if (lead.operational_temperature) {
        await supabase.from("lead_temperature_snapshots").insert({
          lead_id: leadId,
          organization_id: orgId,
          temperature: lead.operational_temperature,
          reason: "initial_seed",
        });
      }
    } catch (e) {
      logAltusError("TEMPERATURE_ERROR", "Temperature snapshot failed", {
        leadId,
        reason: e instanceof Error ? e.message : "unknown",
      });
    }

    // Compliance (best-effort)
    try {
      if (lead.compliance) {
        await supabase.from("lead_compliance_profiles").upsert({
          lead_id: leadId,
          organization_id: orgId,
          marketing_consent: lead.compliance.marketing_consent,
          contact_consent: lead.compliance.contact_consent,
          data_sharing_permitted: lead.compliance.data_sharing_permitted,
          resale_permitted: lead.compliance.resale_permitted,
          suppressed: lead.compliance.suppressed,
          suppression_reason: lead.compliance.suppression_reason,
          retention_policy_days: lead.compliance.retention_policy_days,
          jurisdiction: lead.compliance.jurisdiction,
          consent_basis: lead.compliance.consent_basis,
          consent_captured_at: lead.compliance.consent_captured_at,
          sharing_permissions_note: `consent_version=${lead.compliance.consent_version}`,
          updated_at: now,
        });
      }
    } catch {
      /* non-fatal */
    }

    // Link session → lead
    await supabase
      .from("assessment_sessions")
      .update({
        lead_id: leadId,
        status: "completed",
        contactable: true,
        contact_captured_at: now,
        completed_at: now,
        updated_at: now,
      })
      .eq("id", session.id);

    // Audit
    try {
      await supabase.from("audit_logs").insert({
        organization_id: orgId,
        action: "lead_created",
        entity_type: "lead",
        entity_id: leadId,
        metadata: {
          assessment_session_id: session.id,
          campaign_id: lead.campaign_id,
        },
      });
    } catch {
      /* non-fatal */
    }

    return leadId;
  }
}

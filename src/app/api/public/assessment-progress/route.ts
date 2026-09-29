import { randomUUID } from "crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getSimStore, type SimLead } from "@/application/growth/simulationStore";
import { ProfileCompletenessService } from "@/application/retirement/ProfileCompletenessService";
import { LeadTemperatureService } from "@/application/retirement/LeadTemperatureService";
import { PUBLIC_CONSENT_TEXT, PUBLIC_CONSENT_VERSION } from "@/domain/compliance/consent";
import { rateLimit } from "@/lib/rateLimit";

const draftSchema = z.object({
  organizationSlug: z.string().min(1),
  campaignSlug: z.string().min(1),
  answers: z.record(z.string()).default({}),
  last_stage: z.string().optional(),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().min(7).optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      state: z.string().optional(),
      consent: z.boolean().optional(),
    })
    .optional(),
  attribution: z.record(z.string().nullable()).optional(),
});

/**
 * Partial assessment recovery — saves only provided answers.
 * Never invents unanswered values. Requires consensual contact when recovering.
 */
export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`assessment-progress:${ip}`, 20, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = draftSchema.parse(await request.json());
    const store = getSimStore();
    const campaign = store.campaigns.find(
      (c) =>
        c.organization_slug === body.organizationSlug &&
        c.slug === body.campaignSlug,
    );
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const email = body.contact?.email?.trim();
    const phone = body.contact?.phone?.trim();
    const consent = Boolean(body.contact?.consent);

    // Recovery eligibility: consensual contact required to persist server-side
    if (!consent || (!email && !phone)) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        recovery_eligible: false,
        reason:
          "Server-side recovery requires consent and contact information. Client session save may still apply.",
        completeness: new ProfileCompletenessService().calculate(body.answers),
      });
    }

    // Find existing partial by email/phone or create recovery lead
    let lead =
      store.leads.find(
        (l) =>
          l.campaign_id === campaign.id &&
          ((email && l.email === email) || (phone && l.phone === phone)) &&
          l.status !== "converted",
      ) ?? null;

    const completeness = new ProfileCompletenessService().calculate(body.answers);
    const temperature = new LeadTemperatureService().score({
      answers: body.answers,
      contactComplete: Boolean(email && phone),
      consent,
      appointmentRequested: false,
      assessmentCompleted: completeness.profile_completion_percentage >= 100,
    });

    if (!lead) {
      const id = randomUUID();
      const now = new Date().toISOString();
      lead = {
        id,
        organization_id: campaign.organization_id,
        assigned_organization_id: campaign.organization_id,
        assigned_agent_label: null,
        campaign_id: campaign.id,
        platform_campaign_id:
          campaign.owner_type === "ALTUS_PLATFORM_CAMPAIGN" ? campaign.id : null,
        owner_type: campaign.owner_type,
        status: "new",
        temperature_key: temperature.temperature,
        score: 0,
        fit_score: 0,
        intent_score: 0,
        engagement_score: 0,
        score_version: "partial-recovery-v1",
        scored_at: now,
        score_breakdown: {
          total: 0,
          fit: 0,
          intent: 0,
          engagement: 0,
          classification: "PARTIAL",
          scoring_version: "partial-recovery-v1",
          factors: [],
          explanation: "Partial assessment recovery — unanswered questions not fabricated",
        },
        first_name: body.contact?.firstName ?? "Partial",
        last_name: body.contact?.lastName ?? "Lead",
        business_name: "Partial Assessment",
        email: email ?? `${id}@partial.local`,
        phone: phone ?? "0000000000",
        state: body.contact?.state ?? "FL",
        preferred_contact: "Email",
        consent,
        assessment_answers: { ...body.answers },
        assessment_template_version: campaign.assessment_template_key,
        attribution: {
          lead_id: id,
          organization_id: campaign.organization_id,
          campaign_id: campaign.id,
          platform_campaign_id: null,
          owner_type: campaign.owner_type,
          ad_provider: null,
          external_campaign_id: null,
          ad_set_id: null,
          creative_id: null,
          source: "partial_recovery",
          medium: "assessment",
          utm_source: null,
          utm_medium: null,
          utm_campaign: null,
          utm_content: null,
          utm_term: null,
          landing_page: null,
          territory: body.contact?.state ?? null,
          captured_at: now,
        },
        classifications: [],
        distribution: null,
        distribution_status: "pending",
        created_at: now,
        updated_at: now,
        recovery: {
          is_partial: true,
          last_completed_stage: body.last_stage ?? "questions",
          recovery_eligible: true,
          saved_at: now,
        },
        compliance: {
          marketing_consent: consent,
          contact_consent: consent,
          data_sharing_permitted: consent,
          resale_permitted: false,
          suppressed: false,
          suppression_reason: null,
          retention_policy_days: 365,
          jurisdiction: body.contact?.state ?? "FL",
          restricted_jurisdictions: [],
          consent_basis: "web_form_express",
          consent_captured_at: now,
          consent_text: PUBLIC_CONSENT_TEXT,
          consent_version: PUBLIC_CONSENT_VERSION,
          sharing_permissions_note: "Partial recovery — resale blocked until full consent path",
        },
      } satisfies SimLead;
      Object.freeze(lead.attribution);
      store.leads.unshift(lead);
      campaign.analytics.assessment_starts += 1;
    } else {
      // Merge only provided answers — never overwrite with fabricated blanks
      lead.assessment_answers = {
        ...lead.assessment_answers,
        ...body.answers,
      };
      lead.recovery = {
        is_partial: completeness.profile_completion_percentage < 100,
        last_completed_stage: body.last_stage ?? lead.recovery?.last_completed_stage ?? "questions",
        recovery_eligible: true,
        saved_at: new Date().toISOString(),
      };
      lead.temperature_key = temperature.temperature;
      lead.updated_at = new Date().toISOString();
      if (lead.compliance) {
        lead.compliance.consent_text = PUBLIC_CONSENT_TEXT;
        lead.compliance.consent_version = PUBLIC_CONSENT_VERSION;
      }
    }

    if (!lead) {
      return NextResponse.json(
        { error: "Unable to persist progress" },
        { status: 500 },
      );
    }

    store.events.push({
      id: randomUUID(),
      organization_id: lead.organization_id ?? store.organizations[0]!.id,
      lead_id: lead.id,
      event_type: "assessment_progress_saved",
      occurred_at: new Date().toISOString(),
      actor_profile_id: null,
      payload: {
        completion_percentage: completeness.profile_completion_percentage,
        answered: completeness.answered_core_questions,
        applicable: completeness.applicable_questions,
        last_stage: lead.recovery?.last_completed_stage,
        // Do not log raw PII
      },
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      persisted: true,
      recovery_eligible: true,
      leadId: lead.id,
      completion_percentage: completeness.profile_completion_percentage,
      answered_core_questions: completeness.answered_core_questions,
      applicable_questions: completeness.applicable_questions,
      last_completed_stage: lead.recovery?.last_completed_stage,
      temperature: temperature.temperature,
      temperature_score: temperature.temperature_score,
      available_answers: Object.keys(lead.assessment_answers),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid draft" },
      { status: 400 },
    );
  }
}

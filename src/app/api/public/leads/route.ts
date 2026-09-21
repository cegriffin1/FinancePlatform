import { NextResponse } from "next/server";
import { z } from "zod";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import { getSimStore } from "@/application/growth/simulationStore";
import { rateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  organizationSlug: z.string().min(1),
  campaignSlug: z.string().min(1),
  answers: z.record(z.string()),
  contact: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    businessName: z.string().optional().default(""),
    email: z.string().email(),
    phone: z.string().min(7),
    state: z.string().min(2).max(2),
    preferredContact: z.string().min(1),
    consent: z.literal(true),
  }),
  appointmentRequested: z.boolean().default(false),
  honeypot: z.string().optional().nullable(),
  submissionStartedAt: z.string().optional().nullable(),
  sessionId: z.string().uuid().optional().nullable(),
  attribution: z
    .object({
      utm_source: z.string().nullable().optional(),
      utm_medium: z.string().nullable().optional(),
      utm_campaign: z.string().nullable().optional(),
      utm_content: z.string().nullable().optional(),
      utm_term: z.string().nullable().optional(),
      referrer: z.string().nullable().optional(),
      source_channel: z.string().nullable().optional(),
      landing_page: z.string().nullable().optional(),
      ad_provider: z.string().nullable().optional(),
      external_campaign_id: z.string().nullable().optional(),
      external_ad_set_id: z.string().nullable().optional(),
      external_ad_id: z.string().nullable().optional(),
      external_creative_id: z.string().nullable().optional(),
    })
    .default({}),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`public-leads:${ip}`, 8, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const json = await request.json();
    const parsed = bodySchema.parse(json);
    const result = await processPublicLeadSubmission({
      ...parsed,
      contact: {
        ...parsed.contact,
        businessName:
          parsed.contact.businessName ||
          `${parsed.contact.firstName} ${parsed.contact.lastName}`.trim(),
      },
    });
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      leadId: result.lead.id,
      // Consumer-safe profile only — no score/grade/tier/temperature
      consumerProfile: result.consumerProfile,
      assignedOrganizationId: result.lead.assigned_organization_id,
      distributionStatus: result.lead.distribution_status,
      poolSize: getSimStore().leads.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    const safe = message.replace(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
      "[redacted-email]",
    );
    return NextResponse.json({ error: safe }, { status: 400 });
  }
}

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
    businessName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(7),
    state: z.string().min(2).max(2),
    preferredContact: z.string().min(1),
    consent: z.literal(true),
  }),
  appointmentRequested: z.boolean().default(false),
  honeypot: z.string().optional().nullable(),
  submissionStartedAt: z.string().optional().nullable(),
  attribution: z
    .object({
      utm_source: z.string().nullable().optional(),
      utm_medium: z.string().nullable().optional(),
      utm_campaign: z.string().nullable().optional(),
      utm_content: z.string().nullable().optional(),
      referrer: z.string().nullable().optional(),
      source_channel: z.string().nullable().optional(),
      landing_page: z.string().nullable().optional(),
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
    const result = await processPublicLeadSubmission(parsed);
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      leadId: result.lead.id,
      score: result.lead.score,
      temperature: result.lead.temperature_key,
      grade: result.lead.intelligence?.quality_grade ?? null,
      strategies: result.lead.classifications.map((c) => c.strategy_category),
      assignedOrganizationId: result.lead.assigned_organization_id,
      distributionStatus: result.lead.distribution_status,
      recommendedAction: result.lead.intelligence?.recommended_action ?? null,
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

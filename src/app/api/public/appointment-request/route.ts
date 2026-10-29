import { NextResponse } from "next/server";
import { z } from "zod";
import { DurableProspectService } from "@/application/growth/DurableProspectService";
import { persistPreferredAppointmentRequest } from "@/application/growth/appointmentRequestService";
import { getSimStore } from "@/application/growth/simulationStore";
import { validateAppointmentPreference } from "@/domain/appointments/preferredRequest";
import { isSupabaseDataMode } from "@/lib/dataMode";
import { rateLimit } from "@/lib/rateLimit";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";

const bodySchema = z.object({
  organizationSlug: z.string().min(1),
  campaignSlug: z.string().min(1),
  sessionId: z.string().uuid(),
  resumeToken: z.string().min(16),
  leadId: z.string().uuid(),
  preferredDate: z.string().min(8).max(10),
  preferredTime: z.string().min(4).max(5),
  timeZone: z.string().min(3).max(64),
  preferredContact: z.string().min(1).max(32).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`public-appt-req:${ip}`, 6, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const parsed = bodySchema.parse(await request.json());
    const durable = new DurableProspectService();
    const session = await durable.getAuthorized(
      parsed.sessionId,
      parsed.resumeToken,
    );
    if (!session) {
      return NextResponse.json(
        { error: "Assessment session not found or expired.", code: "SESSION_INVALID" },
        { status: 401 },
      );
    }
    if (
      session.organization_slug !== parsed.organizationSlug ||
      session.campaign_slug !== parsed.campaignSlug
    ) {
      return NextResponse.json(
        { error: "Session does not match this assessment.", code: "SESSION_MISMATCH" },
        { status: 403 },
      );
    }

    const validated = validateAppointmentPreference({
      preferredDate: parsed.preferredDate,
      preferredTime: parsed.preferredTime,
      timeZone: parsed.timeZone,
    });
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    // Resolve lead — must belong to this session/org
    let lead = getSimStore().leads.find((l) => l.id === parsed.leadId) ?? null;

    if (isSupabaseDataMode()) {
      const supabase = createSupabaseServiceClient();
      // leads.territory stores consumer state/region (no leads.state column)
      const { data: row, error: leadLookupError } = await supabase
        .from("leads")
        .select(
          "id,organization_id,campaign_id,assessment_session_id,preferred_contact,first_name,last_name,email,phone,territory",
        )
        .eq("id", parsed.leadId)
        .maybeSingle();
      if (leadLookupError) {
        return NextResponse.json(
          { error: "Unable to resolve lead.", code: "PERSISTENCE_ERROR" },
          { status: 503 },
        );
      }
      if (!row?.id) {
        return NextResponse.json(
          { error: "Lead not found.", code: "NOT_FOUND" },
          { status: 404 },
        );
      }
      if (
        row.assessment_session_id &&
        row.assessment_session_id !== session.id
      ) {
        return NextResponse.json(
          { error: "Lead does not belong to this session.", code: "FORBIDDEN" },
          { status: 403 },
        );
      }
      if (row.organization_id !== session.organization_id) {
        return NextResponse.json(
          { error: "Cross-organization request denied.", code: "FORBIDDEN" },
          { status: 403 },
        );
      }
      lead = {
        id: row.id as string,
        organization_id: row.organization_id as string,
        assigned_organization_id: row.organization_id as string,
        campaign_id: (row.campaign_id as string) ?? session.campaign_id,
        preferred_contact:
          parsed.preferredContact ||
          (row.preferred_contact as string) ||
          "Phone",
        first_name: (row.first_name as string) ?? "",
        last_name: (row.last_name as string) ?? "",
        email: (row.email as string) ?? "",
        phone: (row.phone as string) ?? "",
        state: (row.territory as string) ?? "",
        appointments: [],
      } as unknown as NonNullable<typeof lead>;
    }

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const result = await persistPreferredAppointmentRequest({
      lead,
      preference: validated.value,
      preferredContactMethod:
        parsed.preferredContact || lead.preferred_contact || "Phone",
    });

    if (!result.ok) {
      const status = result.code === "DUPLICATE" ? 409 : 503;
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      appointmentRequestId: result.appointmentId,
      status: "requested",
      confirmed: false,
      message:
        "Preference received. This is a request only — not a confirmed appointment.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

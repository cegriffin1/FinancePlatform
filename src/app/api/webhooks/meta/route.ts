import { NextResponse } from "next/server";
import {
  ingestNativeProviderLead,
  verifyWebhookSignature,
} from "@/application/integrations/nativeLeadIngestion";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWebhookSignature("meta", rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await ingestNativeProviderLead({
      provider: "meta",
      external_event_id: String(
        payload.external_event_id ?? payload.event_id ?? payload.id ?? "",
      ),
      external_campaign_id: String(
        payload.external_campaign_id ?? payload.campaign_id ?? "",
      ),
      external_form_id: payload.form_id ? String(payload.form_id) : undefined,
      contact: {
        firstName: String(
          (payload.contact as { firstName?: string } | undefined)?.firstName ??
            payload.first_name ??
            "Lead",
        ),
        lastName: String(
          (payload.contact as { lastName?: string } | undefined)?.lastName ??
            payload.last_name ??
            "Unknown",
        ),
        businessName: String(
          (payload.contact as { businessName?: string } | undefined)?.businessName ??
            payload.company ??
            "Unknown Business",
        ),
        email: String(
          (payload.contact as { email?: string } | undefined)?.email ??
            payload.email ??
            "",
        ),
        phone: String(
          (payload.contact as { phone?: string } | undefined)?.phone ??
            payload.phone ??
            "0000000000",
        ),
        state: String(
          (payload.contact as { state?: string } | undefined)?.state ??
            payload.state ??
            "FL",
        ),
      },
      signature,
      raw_reference: `meta:${Date.now()}`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

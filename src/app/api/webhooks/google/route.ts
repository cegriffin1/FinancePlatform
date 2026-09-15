import { NextResponse } from "next/server";
import { ingestNativeProviderLead, verifyWebhookSignature } from "@/application/integrations/nativeLeadIngestion";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`webhook-google:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-google-signature");
  if (!verifyWebhookSignature("google", rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const result = await ingestNativeProviderLead({
      provider: "google",
      external_event_id: String(payload.external_event_id ?? payload.id ?? ""),
      external_campaign_id: String(payload.external_campaign_id ?? ""),
      contact: {
        firstName: String(payload.first_name ?? "Lead"),
        lastName: String(payload.last_name ?? "Unknown"),
        businessName: String(payload.company ?? "Unknown Business"),
        email: String(payload.email ?? ""),
        phone: String(payload.phone ?? "0000000000"),
        state: String(payload.state ?? "FL"),
      },
      signature,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

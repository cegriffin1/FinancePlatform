import { randomUUID } from "crypto";
import {
  getIntegrationStore,
  appendAudit,
} from "@/application/integrations/integrationStore";
import { processPublicLeadSubmission } from "@/application/growth/leadPipeline";
import { getSimStore } from "@/application/growth/simulationStore";
import type { LiveAdProvider } from "@/domain/types/social-integrations";
import { createHmac, timingSafeEqual } from "crypto";

export type NativeLeadPayload = {
  provider: LiveAdProvider;
  external_event_id: string;
  external_campaign_id: string;
  external_form_id?: string;
  contact: {
    firstName: string;
    lastName: string;
    businessName?: string;
    email: string;
    phone?: string;
    state?: string;
  };
  answers?: Record<string, string>;
  signature?: string | null;
  raw_reference?: string;
};

export function verifyWebhookSignature(
  provider: LiveAdProvider,
  rawBody: string,
  signature: string | null | undefined,
): boolean {
  const secrets: Record<LiveAdProvider, string | undefined> = {
    meta: process.env.META_WEBHOOK_SECRET ?? process.env.META_APP_SECRET,
    linkedin: process.env.LINKEDIN_WEBHOOK_SECRET ?? process.env.LINKEDIN_CLIENT_SECRET,
    google: process.env.GOOGLE_ADS_WEBHOOK_SECRET,
  };

  // Simulation mode: accept unsigned only when not LIVE.
  // LIVE mode fails closed without a configured secret.
  const secret = secrets[provider];
  if (!secret) {
    if (process.env.PROVIDER_MODE === "LIVE") return false;
    return true;
  }
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signature.replace(/^sha256=/, "");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

export async function ingestNativeProviderLead(payload: NativeLeadPayload) {
  const store = getIntegrationStore();
  const dedupeKey = `${payload.provider}:${payload.external_event_id}`;

  const existingWebhook = store.webhooks.find(
    (w) =>
      w.provider === payload.provider &&
      w.external_event_id === payload.external_event_id,
  );
  if (existingWebhook?.processing_status === "processed") {
    return { duplicate: true as const, leadId: null };
  }

  if (store.ingestedLeadKeys.has(dedupeKey)) {
    return { duplicate: true as const, leadId: null };
  }

  const mapping = store.mappings.find(
    (m) =>
      m.provider === payload.provider &&
      m.external_entity_type === "campaign" &&
      m.external_entity_id === payload.external_campaign_id,
  );

  if (!mapping) {
    store.webhooks.push({
      id: randomUUID(),
      organization_id: null,
      provider: payload.provider,
      external_event_id: payload.external_event_id,
      event_type: "lead",
      received_at: new Date().toISOString(),
      processing_status: "failed",
      payload_reference: payload.raw_reference ?? dedupeKey,
      processed_at: null,
      error: "No ALTUS campaign mapping for external campaign",
    });
    throw new Error("Unknown external campaign mapping");
  }

  const sim = getSimStore();
  const campaign = sim.campaigns.find((c) => c.id === mapping.internal_entity_id);
  if (!campaign) {
    throw new Error("Mapped ALTUS campaign not found in simulation store");
  }

  const webhookId = randomUUID();
  store.webhooks.push({
    id: webhookId,
    organization_id: mapping.organization_id,
    provider: payload.provider,
    external_event_id: payload.external_event_id,
    event_type: "lead",
    received_at: new Date().toISOString(),
    processing_status: "received",
    payload_reference: payload.raw_reference ?? dedupeKey,
    processed_at: null,
    error: null,
  });

  const result = await processPublicLeadSubmission({
    organizationSlug: campaign.organization_slug,
    campaignSlug: campaign.slug,
    answers: payload.answers ?? {
      business_stage: "Growing steadily",
      financial_priority: "Reduce tax exposure",
      team_size: "26–50",
      revenue_range: "$1M–$5M",
      timeline: "Within 30 days",
    },
    contact: {
      firstName: payload.contact.firstName,
      lastName: payload.contact.lastName,
      businessName: payload.contact.businessName ?? "Unknown Business",
      email: payload.contact.email,
      phone: payload.contact.phone ?? "0000000000",
      state: payload.contact.state ?? campaign.territories[0] ?? "FL",
      preferredContact: "Email",
      consent: true,
    },
    appointmentRequested: false,
    attribution: {
      utm_source: payload.provider,
      utm_medium: "native_lead_form",
      utm_campaign: campaign.slug,
      source_channel: payload.provider,
      landing_page: `provider://${payload.provider}/form`,
      ad_provider: payload.provider,
      external_campaign_id: payload.external_campaign_id,
    },
  });

  const lead = result.lead;

  store.ingestedLeadKeys.add(dedupeKey);
  const webhook = store.webhooks.find((w) => w.id === webhookId);
  if (webhook) {
    webhook.processing_status = "processed";
    webhook.processed_at = new Date().toISOString();
  }

  appendAudit({
    organization_id: mapping.organization_id,
    actor_profile_id: null,
    action: "provider.lead_ingested",
    entity_type: "lead",
    entity_id: lead.id,
    metadata: {
      provider: payload.provider,
      external_event_id: payload.external_event_id,
      external_campaign_id: payload.external_campaign_id,
    },
  });

  return { duplicate: false as const, leadId: lead.id, lead };
}

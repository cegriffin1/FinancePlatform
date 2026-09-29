import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getIntegrationStore,
  publicConnectionView,
  upsertSimConnection,
  appendAudit,
} from "@/application/integrations/integrationStore";
import { getChannelProvider } from "@/infrastructure/providers/channels/mockChannelProviders";
import { CHANNEL_CAPABILITIES, LIVE_AD_PROVIDERS } from "@/domain/types/social-integrations";
import { getProviderMode } from "@/infrastructure/security/credentialVault";
import { runQueuedIntegrationJobs } from "@/application/integrations/registerJobs";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";

const DEMO_ORG = "20000000-0000-4000-8000-000000000003";

export async function GET() {
  const auth = await requireOrgAuth({ permission: "integrations.view" });
  if (!auth.ok) return auth.response;

  const store = getIntegrationStore();
  const connections = LIVE_AD_PROVIDERS.map((provider) => {
    const existing = store.connections.find(
      (c) => c.organization_id === DEMO_ORG && c.provider === provider,
    );
    if (existing) return publicConnectionView(existing);
    return {
      id: null,
      provider,
      status: "NOT_CONNECTED" as const,
      mode: getProviderMode(),
      display_account_name: null,
      provider_account_id: null,
      last_synced_at: null,
      token_expires_at: null,
      permissions_summary: [],
      last_error: null,
    };
  });

  return NextResponse.json({
    mode: getProviderMode(),
    capabilities: CHANNEL_CAPABILITIES,
    connections,
    creatives: store.creatives.filter((c) => c.organization_id === DEMO_ORG),
    audits: store.audits.filter((a) => a.organization_id === DEMO_ORG).slice(0, 50),
  });
}

export async function POST(request: Request) {
  const auth = await requireOrgAuth({ permission: "integrations.manage" });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action as string;

    if (action === "connect") {
      const parsed = z
        .object({
          provider: z.enum(["meta", "linkedin", "google"]),
          authCode: z.string().default("sim_oauth_code"),
        })
        .parse(body);
      const provider = getChannelProvider(parsed.provider);
      const result = await provider.connectAccount(DEMO_ORG, parsed.authCode);
      await runQueuedIntegrationJobs(5);
      return NextResponse.json({ ok: true, ...result, mode: getProviderMode() });
    }

    if (action === "disconnect") {
      const parsed = z
        .object({
          provider: z.enum(["meta", "linkedin", "google"]),
          connectionId: z.string().uuid(),
        })
        .parse(body);
      await getChannelProvider(parsed.provider).disconnectAccount(
        DEMO_ORG,
        parsed.connectionId,
      );
      appendAudit({
        organization_id: DEMO_ORG,
        actor_profile_id: null,
        action: "provider.disconnected",
        entity_type: "integration_connection",
        entity_id: parsed.connectionId,
        metadata: { provider: parsed.provider },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "retry_sync") {
      const parsed = z
        .object({
          provider: z.enum(["meta", "linkedin", "google"]),
          connectionId: z.string().uuid(),
        })
        .parse(body);
      const store = getIntegrationStore();
      const conn = store.connections.find(
        (c) => c.id === parsed.connectionId && c.organization_id === DEMO_ORG,
      );
      if (!conn) throw new Error("Connection not found");
      conn.last_synced_at = new Date().toISOString();
      conn.status = "CONNECTED";
      conn.last_error = null;
      return NextResponse.json({ ok: true });
    }

    if (action === "create_creative") {
      const parsed = z
        .object({
          asset_type: z.enum(["image", "video", "copy"]),
          headline: z.string().min(2),
          body: z.string().min(2),
          cta: z.string().min(1),
          destination_url: z.string().nullable().optional(),
          file_reference: z.string().nullable().optional(),
        })
        .parse(body);
      const store = getIntegrationStore();
      const creative = {
        id: crypto.randomUUID(),
        organization_id: DEMO_ORG,
        asset_type: parsed.asset_type,
        file_reference: parsed.file_reference ?? null,
        headline: parsed.headline,
        body: parsed.body,
        cta: parsed.cta,
        destination_url: parsed.destination_url ?? null,
        status: "active" as const,
        created_by: null,
        created_at: new Date().toISOString(),
      };
      store.creatives.unshift(creative);
      return NextResponse.json({ ok: true, creative });
    }

    if (action === "seed_simulation") {
      for (const provider of LIVE_AD_PROVIDERS) {
        upsertSimConnection({
          organizationId: DEMO_ORG,
          provider,
          accountName:
            provider === "meta"
              ? "ALTUS Financial Group"
              : provider === "linkedin"
                ? "Demo Organization LinkedIn"
                : "Demo Organization Google Ads",
        });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

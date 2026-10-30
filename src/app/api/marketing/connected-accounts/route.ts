import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAuth } from "@/infrastructure/security/requireOrgAuth";
import { listConnectedAccountCards } from "@/application/integrations/ConnectedAccountsService";
import {
  beginSocialOauthConnect,
  disconnectSocialProvider,
  reconnectSocialPlatform,
} from "@/application/integrations/SocialOAuthService";
import {
  isConnectedPlatform,
  platformToOauthProvider,
} from "@/domain/social/connectedPlatforms";
import { getProviderMode } from "@/infrastructure/security/credentialVault";
import { listMarketingFoundationModules } from "@/application/marketing/marketingFoundation";
import {
  touchDurableConnectionSync,
  isDurableIntegrationConnectionsEnabled,
} from "@/application/integrations/IntegrationConnectionRepository";
import { isDurableOauthStateStoreEnabled } from "@/application/integrations/oauthStateStore";

/** Local sim fallback only — production requires a real membership org id. */
const SIM_FALLBACK_ORG = "20000000-0000-4000-8000-000000000003";

function resolveOrgId(organizationId: string | null): string | null {
  if (organizationId) return organizationId;
  if (process.env.NODE_ENV !== "production") return SIM_FALLBACK_ORG;
  return null;
}

export async function GET() {
  const auth = await requireOrgAuth({ permission: "integrations.view" });
  if (!auth.ok) return auth.response;
  const orgId = resolveOrgId(auth.ctx.organizationId);
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization required", code: "ORG_REQUIRED" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    mode: getProviderMode(),
    simulationOnly: true,
    durablePersistence: isDurableIntegrationConnectionsEnabled(),
    durableOauthState: isDurableOauthStateStoreEnabled(),
    platforms: await listConnectedAccountCards(orgId),
    foundation: listMarketingFoundationModules(),
    safety: {
      simulation_only: true,
      live_social_oauth_enabled: false,
      highwater_public_launch: process.env.HIGHWATER_PUBLIC_LAUNCH ?? null,
      allow_live_ad_publish: process.env.ALLOW_LIVE_AD_PUBLISH === "true",
      publishes_disabled: true,
      note: "SIMULATION ONLY for provider OAuth — connections may persist durably in Supabase mode. No live provider OAuth, posting, advertising, or budget spend.",
    },
  });
}

export async function POST(request: Request) {
  const auth = await requireOrgAuth({ permission: "integrations.manage" });
  if (!auth.ok) return auth.response;
  const orgId = resolveOrgId(auth.ctx.organizationId);
  if (!orgId) {
    return NextResponse.json(
      { error: "Organization required", code: "ORG_REQUIRED" },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const action = z
      .enum(["connect", "disconnect", "reconnect", "retry_sync"])
      .parse(body.action);
    const platform = z.string().parse(body.platform);
    if (!isConnectedPlatform(platform)) {
      return NextResponse.json(
        { error: "Unknown platform", code: "PLATFORM_INVALID" },
        { status: 400 },
      );
    }

    if (action === "connect" || action === "reconnect") {
      const result =
        action === "connect"
          ? await beginSocialOauthConnect({
              organizationId: orgId,
              platform,
              profileId: auth.ctx.profileId,
            })
          : await reconnectSocialPlatform({
              organizationId: orgId,
              platform,
              profileId: auth.ctx.profileId,
            });
      if (result.redirect === "blocked") {
        return NextResponse.json(
          {
            ok: false,
            simulationOnly: true,
            error: result.error,
            code: result.code,
            missingEnvCount: result.missingEnv.length,
          },
          { status: 503 },
        );
      }
      return NextResponse.json({
        ok: true,
        simulationOnly: true,
        mode: result.mode,
        redirect: result.redirect,
        message: result.message,
        connection: result.connection,
      });
    }

    if (action === "disconnect") {
      const connectionId = z.string().uuid().parse(body.connectionId);
      const provider = platformToOauthProvider(platform);
      const result = await disconnectSocialProvider({
        organizationId: orgId,
        provider,
        connectionId,
        profileId: auth.ctx.profileId,
      });
      if (!result.ok) {
        return NextResponse.json(result, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "retry_sync") {
      const connectionId = z.string().uuid().parse(body.connectionId);
      const provider = platformToOauthProvider(platform);
      const result = await touchDurableConnectionSync({
        organizationId: orgId,
        provider,
        connectionId,
      });
      if (!result.ok) {
        return NextResponse.json(result, {
          status: result.code === "NOT_FOUND" ? 404 : 503,
        });
      }
      return NextResponse.json({
        ok: true,
        lastSuccessfulSync: result.lastSuccessfulSync,
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

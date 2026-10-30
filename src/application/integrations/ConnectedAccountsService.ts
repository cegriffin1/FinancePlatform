import {
  CONNECTED_PLATFORMS,
  CONNECTED_PLATFORM_CATALOG,
  type ConnectedPlatform,
  type SocialOauthProvider,
  platformToOauthProvider,
} from "@/domain/social/connectedPlatforms";
import { getProviderMode } from "@/infrastructure/security/credentialVault";
import {
  missingOauthEnv,
  oauthConfigured,
} from "@/application/integrations/SocialOAuthService";
import { listDurableConnections } from "@/application/integrations/IntegrationConnectionRepository";
import type { ProviderCredentialRecord } from "@/domain/types/social-integrations";

export type ConnectedAccountCard = {
  platform: ConnectedPlatform;
  label: string;
  subtitle: string;
  oauthProvider: SocialOauthProvider;
  status: string;
  accountName: string | null;
  authorizedAssets: string[];
  permissions: string[];
  lastSuccessfulSync: string | null;
  connectionId: string | null;
  mode: string;
  lastError: string | null;
  liveOauthConfigured: boolean;
  missingEnv: string[];
  organicPublishing: string;
  advertising: string;
  analytics: string;
  leadAttribution: string;
  setupNotes: string[];
  canConnect: boolean;
  canDisconnect: boolean;
  canReconnect: boolean;
};

function connectionForProvider(
  connections: ProviderCredentialRecord[],
  provider: SocialOauthProvider,
): ProviderCredentialRecord | null {
  const row = connections.find((c) => c.provider === provider) ?? null;
  if (!row) return null;
  // Treat soft-disconnect as not connected for UI cards.
  if (
    row.status === "disconnected" ||
    row.status === "NOT_CONNECTED" ||
    !row.credential_ref
  ) {
    return null;
  }
  return row;
}

export async function listConnectedAccountCards(
  organizationId: string,
): Promise<ConnectedAccountCard[]> {
  const mode = getProviderMode();
  const connections = await listDurableConnections(organizationId);

  return CONNECTED_PLATFORMS.map((platform) => {
    const def = CONNECTED_PLATFORM_CATALOG[platform];
    const provider = platformToOauthProvider(platform);
    const conn = connectionForProvider(connections, provider);
    const connected =
      Boolean(conn) &&
      (conn!.status === "CONNECTED" || conn!.status === "connected");
    const missing = missingOauthEnv(provider);

    return {
      platform,
      label: def.label,
      subtitle: def.subtitle,
      oauthProvider: provider,
      status: connected ? "CONNECTED" : "NOT_CONNECTED",
      accountName: conn?.display_account_name ?? null,
      authorizedAssets: conn?.authorized_assets ?? [],
      permissions: conn?.permissions_summary ?? [],
      lastSuccessfulSync: conn?.last_synced_at ?? null,
      connectionId: conn?.id ?? null,
      mode: conn?.mode ?? mode,
      lastError: conn?.last_error ?? null,
      liveOauthConfigured: oauthConfigured(provider),
      missingEnv: missing,
      organicPublishing: def.organicPublishing,
      advertising: def.advertising,
      analytics: def.analytics,
      leadAttribution: def.leadAttribution,
      setupNotes: def.setupNotes,
      canConnect: !connected,
      canDisconnect: Boolean(connected && conn?.id),
      canReconnect: Boolean(connected && conn?.id),
    };
  });
}

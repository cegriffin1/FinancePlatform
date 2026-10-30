import {
  CONNECTED_PLATFORMS,
  CONNECTED_PLATFORM_CATALOG,
  type ConnectedPlatform,
  type SocialOauthProvider,
  platformToOauthProvider,
} from "@/domain/social/connectedPlatforms";
import { getIntegrationStore } from "@/application/integrations/integrationStore";
import { getProviderMode } from "@/infrastructure/security/credentialVault";
import {
  missingOauthEnv,
  oauthConfigured,
} from "@/application/integrations/SocialOAuthService";

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

function connectionForOrgProvider(
  organizationId: string,
  provider: SocialOauthProvider,
) {
  return getIntegrationStore().connections.find(
    (c) => c.organization_id === organizationId && c.provider === provider,
  );
}

export function listConnectedAccountCards(
  organizationId: string,
): ConnectedAccountCard[] {
  const mode = getProviderMode();
  return CONNECTED_PLATFORMS.map((platform) => {
    const def = CONNECTED_PLATFORM_CATALOG[platform];
    const provider = platformToOauthProvider(platform);
    const conn = connectionForOrgProvider(organizationId, provider);
    const connected = conn?.status === "CONNECTED";
    const missing = missingOauthEnv(provider);

    return {
      platform,
      label: def.label,
      subtitle: def.subtitle,
      oauthProvider: provider,
      status: conn?.status ?? "NOT_CONNECTED",
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

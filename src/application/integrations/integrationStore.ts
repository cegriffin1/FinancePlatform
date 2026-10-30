import { randomUUID } from "crypto";
import type {
  CreativeAsset,
  ExternalRecordMapping,
  NormalizedCampaignMetrics,
  ProviderCredentialRecord,
  ProviderWebhookEvent,
  PublishAuditEvent,
  LiveAdProvider,
  SocialConnectionProvider,
} from "@/domain/types/social-integrations";
import { sealTokenBundle } from "@/infrastructure/security/credentialVault";

export type ChannelMetricsSnapshot = {
  id: string;
  organization_id: string;
  campaign_id: string;
  provider: LiveAdProvider;
  date: string;
  metrics: NormalizedCampaignMetrics;
};

export type PublishRecord = {
  id: string;
  organization_id: string;
  campaign_id: string;
  provider: LiveAdProvider;
  idempotency_key: string;
  status: "pending" | "published" | "failed";
  external_campaign_id: string | null;
  error: string | null;
  created_at: string;
};

export type IntegrationStore = {
  connections: ProviderCredentialRecord[];
  mappings: ExternalRecordMapping[];
  creatives: CreativeAsset[];
  webhooks: ProviderWebhookEvent[];
  metrics: ChannelMetricsSnapshot[];
  publishes: PublishRecord[];
  audits: PublishAuditEvent[];
  ingestedLeadKeys: Set<string>;
};

const globalKey = "__altus_integration_store__";

function seed(): IntegrationStore {
  return {
    connections: [],
    mappings: [],
    creatives: [],
    webhooks: [],
    metrics: [],
    publishes: [],
    audits: [],
    ingestedLeadKeys: new Set(),
  };
}

export function getIntegrationStore(): IntegrationStore {
  const g = globalThis as typeof globalThis & { [globalKey]?: IntegrationStore };
  if (!g[globalKey]) g[globalKey] = seed();
  return g[globalKey];
}

export function resetIntegrationStore() {
  const g = globalThis as typeof globalThis & { [globalKey]?: IntegrationStore };
  g[globalKey] = seed();
  return g[globalKey];
}

export function appendAudit(input: Omit<PublishAuditEvent, "id" | "created_at">) {
  const store = getIntegrationStore();
  const event: PublishAuditEvent = {
    ...input,
    id: randomUUID(),
    created_at: new Date().toISOString(),
  };
  store.audits.unshift(event);
  return event;
}

export function upsertSimConnection(input: {
  organizationId: string;
  provider: SocialConnectionProvider;
  accountName: string;
  accountId?: string;
  businessId?: string;
  scopes?: string[];
  permissionsSummary?: string[];
  authorizedAssets?: string[];
  connectedBy?: string | null;
  platformHint?: string | null;
}): ProviderCredentialRecord {
  const store = getIntegrationStore();
  const existing = store.connections.find(
    (c) => c.organization_id === input.organizationId && c.provider === input.provider,
  );
  const now = new Date().toISOString();
  const scopes = input.scopes ?? ["ads_management", "leads_retrieval"];
  const credential_ref = sealTokenBundle({
    access_token: `sim_access_${input.provider}`,
    refresh_token: `sim_refresh_${input.provider}`,
    expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    scopes,
  });

  if (existing) {
    existing.status = "CONNECTED";
    existing.display_account_name = input.accountName;
    existing.provider_account_id = input.accountId ?? existing.provider_account_id;
    existing.provider_business_id = input.businessId ?? existing.provider_business_id;
    existing.credential_ref = credential_ref;
    existing.last_refreshed_at = now;
    existing.last_synced_at = now;
    existing.last_error = null;
    existing.token_expires_at = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    existing.scopes = scopes;
    if (input.permissionsSummary) {
      existing.permissions_summary = input.permissionsSummary;
    }
    if (input.authorizedAssets) {
      existing.authorized_assets = input.authorizedAssets;
    }
    if (input.platformHint !== undefined) {
      existing.platform_hint = input.platformHint;
    }
    if (input.connectedBy !== undefined) {
      existing.connected_by = input.connectedBy;
    }
    return existing;
  }

  const record: ProviderCredentialRecord = {
    id: randomUUID(),
    organization_id: input.organizationId,
    provider: input.provider,
    status: "CONNECTED",
    mode: "SIMULATION",
    provider_account_id: input.accountId ?? `${input.provider}_acct_001`,
    provider_business_id: input.businessId ?? `${input.provider}_biz_001`,
    scopes,
    connected_by: input.connectedBy ?? null,
    connected_at: now,
    last_refreshed_at: now,
    last_synced_at: now,
    token_expires_at: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    credential_ref,
    last_error: null,
    permissions_summary: input.permissionsSummary ?? [
      "Manage ads",
      "Read leads",
      "Read insights",
    ],
    display_account_name: input.accountName,
    authorized_assets: input.authorizedAssets ?? [],
    platform_hint: input.platformHint ?? null,
  };
  store.connections.push(record);
  appendAudit({
    organization_id: input.organizationId,
    actor_profile_id: input.connectedBy ?? null,
    action: "provider.connected",
    entity_type: "integration_connection",
    entity_id: record.id,
    metadata: {
      provider: input.provider,
      mode: "SIMULATION",
      platform_hint: input.platformHint ?? null,
    },
  });
  return record;
}

export function publicConnectionView(c: ProviderCredentialRecord) {
  return {
    id: c.id,
    provider: c.provider,
    status: c.status,
    mode: c.mode,
    display_account_name: c.display_account_name,
    provider_account_id: c.provider_account_id,
    last_synced_at: c.last_synced_at,
    token_expires_at: c.token_expires_at,
    permissions_summary: c.permissions_summary,
    authorized_assets: c.authorized_assets ?? [],
    platform_hint: c.platform_hint ?? null,
    last_error: c.last_error,
    // never expose credential_ref
  };
}

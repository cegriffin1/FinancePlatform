/**
 * Durable integration_connections persistence (org-scoped).
 * credential_ref is sealed server-side and never included in public DTOs.
 */
import { randomUUID } from "crypto";
import type {
  IntegrationConnectionStatus,
  ProviderCredentialRecord,
  ProviderMode,
  SocialConnectionProvider,
} from "@/domain/types/social-integrations";
import {
  getIntegrationStore,
  publicConnectionView,
  upsertSimConnection,
  appendAudit,
} from "@/application/integrations/integrationStore";
import { sealTokenBundle } from "@/infrastructure/security/credentialVault";
import { isSupabaseDataMode } from "@/lib/dataMode";
import { hasSupabaseConfig } from "@/lib/env";
import { logAltusError } from "@/lib/observability";

export function isDurableIntegrationConnectionsEnabled(): boolean {
  return (
    isSupabaseDataMode() &&
    hasSupabaseConfig() &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

function rowToRecord(row: Record<string, unknown>): ProviderCredentialRecord {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    provider: row.provider as SocialConnectionProvider,
    status: (row.status as IntegrationConnectionStatus) || "NOT_CONNECTED",
    mode: (row.mode as ProviderMode) || "SIMULATION",
    provider_account_id: (row.provider_account_id as string) ?? null,
    provider_business_id: (row.provider_business_id as string) ?? null,
    scopes: (row.scopes as string[]) ?? [],
    connected_by: (row.created_by as string) ?? null,
    connected_at: (row.connected_at as string) ?? null,
    last_refreshed_at: (row.last_refreshed_at as string) ?? null,
    last_synced_at: (row.last_synced_at as string) ?? null,
    token_expires_at: (row.token_expires_at as string) ?? null,
    credential_ref: (row.credential_ref as string) ?? "",
    last_error: (row.last_error as string) ?? null,
    permissions_summary: (row.permissions_summary as string[]) ?? [],
    display_account_name: (row.display_account_name as string) ?? null,
    authorized_assets: (row.authorized_assets as string[]) ?? [],
    platform_hint: (row.platform_hint as string) ?? null,
  };
}

export async function getDurableConnection(
  organizationId: string,
  provider: SocialConnectionProvider,
): Promise<ProviderCredentialRecord | null> {
  if (!isDurableIntegrationConnectionsEnabled()) {
    return (
      getIntegrationStore().connections.find(
        (c) => c.organization_id === organizationId && c.provider === provider,
      ) ?? null
    );
  }
  try {
    const { createSupabaseServiceClient } = await import(
      "@/infrastructure/supabase/admin"
    );
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .maybeSingle();
    if (error) {
      logAltusError("DATABASE_ERROR", "Connection lookup failed", {
        reason: error.message,
      });
      return null;
    }
    if (!data) return null;
    return rowToRecord(data as Record<string, unknown>);
  } catch (e) {
    logAltusError("DATABASE_ERROR", "Connection lookup unavailable", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    return null;
  }
}

export async function listDurableConnections(
  organizationId: string,
): Promise<ProviderCredentialRecord[]> {
  if (!isDurableIntegrationConnectionsEnabled()) {
    return getIntegrationStore().connections.filter(
      (c) => c.organization_id === organizationId,
    );
  }
  try {
    const { createSupabaseServiceClient } = await import(
      "@/infrastructure/supabase/admin"
    );
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("integration_connections")
      .select("*")
      .eq("organization_id", organizationId);
    if (error) {
      logAltusError("DATABASE_ERROR", "Connection list failed", {
        reason: error.message,
      });
      return [];
    }
    return (data ?? []).map((row) => rowToRecord(row as Record<string, unknown>));
  } catch (e) {
    logAltusError("DATABASE_ERROR", "Connection list unavailable", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    return [];
  }
}

export type UpsertConnectionInput = {
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
  mode?: ProviderMode;
  status?: IntegrationConnectionStatus;
  /** Optional pre-sealed ref; otherwise a simulation seal is created. */
  credentialRef?: string;
  tokenExpiresAt?: string | null;
};

export async function upsertDurableConnection(
  input: UpsertConnectionInput,
): Promise<ProviderCredentialRecord> {
  const now = new Date().toISOString();
  const scopes = input.scopes ?? ["ads_management", "leads_retrieval"];
  const credential_ref =
    input.credentialRef ??
    sealTokenBundle({
      access_token: `sim_access_${input.provider}`,
      refresh_token: `sim_refresh_${input.provider}`,
      expires_at: input.tokenExpiresAt ?? new Date(Date.now() + 7 * 864e5).toISOString(),
      scopes,
    });

  // Always keep sim store in sync for legacy channel adapters.
  const memory = upsertSimConnection({
    organizationId: input.organizationId,
    provider: input.provider,
    accountName: input.accountName,
    accountId: input.accountId,
    businessId: input.businessId,
    scopes,
    permissionsSummary: input.permissionsSummary,
    authorizedAssets: input.authorizedAssets,
    connectedBy: input.connectedBy,
    platformHint: input.platformHint,
  });

  if (!isDurableIntegrationConnectionsEnabled()) {
    return memory;
  }

  try {
    const { createSupabaseServiceClient } = await import(
      "@/infrastructure/supabase/admin"
    );
    const supabase = createSupabaseServiceClient();
    const payload = {
      organization_id: input.organizationId,
      provider: input.provider,
      status: input.status ?? "CONNECTED",
      mode: input.mode ?? "SIMULATION",
      provider_account_id: input.accountId ?? memory.provider_account_id,
      provider_business_id: input.businessId ?? memory.provider_business_id,
      scopes,
      connected_at: now,
      last_refreshed_at: now,
      last_synced_at: now,
      token_expires_at:
        input.tokenExpiresAt ?? new Date(Date.now() + 7 * 864e5).toISOString(),
      credential_ref,
      last_error: null,
      permissions_summary:
        input.permissionsSummary ?? memory.permissions_summary,
      display_account_name: input.accountName,
      authorized_assets: input.authorizedAssets ?? [],
      platform_hint: input.platformHint ?? null,
      created_by: input.connectedBy ?? null,
      updated_by: input.connectedBy ?? null,
      updated_at: now,
      config: {},
    };

    const { data, error } = await supabase
      .from("integration_connections")
      .upsert(payload, { onConflict: "organization_id,provider" })
      .select("*")
      .single();

    if (error || !data) {
      logAltusError("DATABASE_ERROR", "Connection upsert failed", {
        reason: error?.message ?? "no row",
      });
      // Fail closed for durable mode — do not pretend durable write succeeded.
      throw new Error("Unable to persist integration connection");
    }

    const record = rowToRecord(data as Record<string, unknown>);
    // Mirror durable id into memory for adapters that key by id
    const store = getIntegrationStore();
    const idx = store.connections.findIndex(
      (c) =>
        c.organization_id === input.organizationId &&
        c.provider === input.provider,
    );
    if (idx >= 0) store.connections[idx] = record;
    else store.connections.push(record);

    appendAudit({
      organization_id: input.organizationId,
      actor_profile_id: input.connectedBy ?? null,
      action: "provider.connected",
      entity_type: "integration_connection",
      entity_id: record.id,
      metadata: {
        provider: input.provider,
        mode: record.mode,
        durable: true,
        platform_hint: input.platformHint ?? null,
      },
    });

    return record;
  } catch (e) {
    logAltusError("DATABASE_ERROR", "Connection upsert unavailable", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    throw e instanceof Error ? e : new Error("Unable to persist integration connection");
  }
}

export async function disconnectDurableConnection(input: {
  organizationId: string;
  provider: SocialConnectionProvider;
  connectionId: string;
  profileId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  // Memory first (compat)
  const store = getIntegrationStore();
  const memIdx = store.connections.findIndex(
    (c) =>
      c.id === input.connectionId &&
      c.organization_id === input.organizationId &&
      c.provider === input.provider,
  );
  if (memIdx >= 0) store.connections.splice(memIdx, 1);

  if (!isDurableIntegrationConnectionsEnabled()) {
    if (memIdx < 0) {
      return { ok: false, error: "Connection not found for organization", code: "NOT_FOUND" };
    }
    appendAudit({
      organization_id: input.organizationId,
      actor_profile_id: input.profileId ?? null,
      action: "provider.disconnected",
      entity_type: "integration_connection",
      entity_id: input.connectionId,
      metadata: { provider: input.provider, durable: false },
    });
    return { ok: true };
  }

  try {
    const { createSupabaseServiceClient } = await import(
      "@/infrastructure/supabase/admin"
    );
    const supabase = createSupabaseServiceClient();
    // Clear secrets and mark disconnected rather than hard-delete (auditability).
    const { data, error } = await supabase
      .from("integration_connections")
      .update({
        status: "disconnected",
        credential_ref: null,
        last_error: null,
        updated_at: new Date().toISOString(),
        updated_by: input.profileId ?? null,
      })
      .eq("id", input.connectionId)
      .eq("organization_id", input.organizationId)
      .eq("provider", input.provider)
      .select("id")
      .maybeSingle();

    if (error) {
      logAltusError("DATABASE_ERROR", "Connection disconnect failed", {
        reason: error.message,
      });
      return { ok: false, error: "Unable to disconnect", code: "DATABASE_ERROR" };
    }
    if (!data?.id && memIdx < 0) {
      return { ok: false, error: "Connection not found for organization", code: "NOT_FOUND" };
    }

    appendAudit({
      organization_id: input.organizationId,
      actor_profile_id: input.profileId ?? null,
      action: "provider.disconnected",
      entity_type: "integration_connection",
      entity_id: input.connectionId,
      metadata: { provider: input.provider, durable: true },
    });
    return { ok: true };
  } catch (e) {
    logAltusError("DATABASE_ERROR", "Connection disconnect unavailable", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    return { ok: false, error: "Unable to disconnect", code: "DATABASE_ERROR" };
  }
}

export async function touchDurableConnectionSync(input: {
  organizationId: string;
  provider: SocialConnectionProvider;
  connectionId: string;
}): Promise<{ ok: true; lastSuccessfulSync: string } | { ok: false; code: string; error: string }> {
  const now = new Date().toISOString();
  const store = getIntegrationStore();
  const mem = store.connections.find(
    (c) =>
      c.id === input.connectionId &&
      c.organization_id === input.organizationId &&
      c.provider === input.provider,
  );
  if (mem) {
    mem.last_synced_at = now;
    mem.status = "CONNECTED";
    mem.last_error = null;
  }

  if (!isDurableIntegrationConnectionsEnabled()) {
    if (!mem) return { ok: false, code: "NOT_FOUND", error: "Connection not found" };
    return { ok: true, lastSuccessfulSync: now };
  }

  try {
    const { createSupabaseServiceClient } = await import(
      "@/infrastructure/supabase/admin"
    );
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("integration_connections")
      .update({
        last_synced_at: now,
        status: "CONNECTED",
        last_error: null,
        updated_at: now,
      })
      .eq("id", input.connectionId)
      .eq("organization_id", input.organizationId)
      .eq("provider", input.provider)
      .select("id")
      .maybeSingle();
    if (error) {
      return { ok: false, code: "DATABASE_ERROR", error: "Sync update failed" };
    }
    if (!data?.id && !mem) {
      return { ok: false, code: "NOT_FOUND", error: "Connection not found" };
    }
    return { ok: true, lastSuccessfulSync: now };
  } catch {
    return { ok: false, code: "DATABASE_ERROR", error: "Sync update unavailable" };
  }
}

export { publicConnectionView, randomUUID };

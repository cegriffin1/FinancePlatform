/**
 * OAuth state tokens for social connect flows.
 * HMAC-signed, org + user bound, short TTL, single-use.
 *
 * Durability:
 * - Supabase data mode → oauth_state_nonces (atomic UPDATE consume; multi-instance safe)
 * - Simulation / unit tests → in-memory Map fallback
 *
 * LIVE provider redirects remain disabled separately (LIVE_SOCIAL_OAUTH_ENABLED).
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isSupabaseDataMode } from "@/lib/dataMode";
import { hasSupabaseConfig } from "@/lib/env";
import { logAltusError } from "@/lib/observability";

export type OAuthStatePayload = {
  nonce: string;
  organizationId: string;
  provider: string;
  platform: string;
  profileId: string | null;
  issuedAt: number;
  expiresAt: number;
};

type StoredState = OAuthStatePayload & { consumed: boolean };

const globalKey = "__altus_oauth_state_store__";
const DEFAULT_TTL_MS = 10 * 60_000;
const DEV_FALLBACK_SECRET = "altus-dev-oauth-state-only";

function storeMap(): Map<string, StoredState> {
  const g = globalThis as typeof globalThis & {
    [globalKey]?: Map<string, StoredState>;
  };
  if (!g[globalKey]) g[globalKey] = new Map();
  return g[globalKey];
}

export function oauthStateSigningSecretSource():
  | "OAUTH_STATE_SIGNING_SECRET"
  | "PROVIDER_CREDENTIAL_ENCRYPTION_KEY"
  | "DEV_FALLBACK" {
  if (process.env.OAUTH_STATE_SIGNING_SECRET?.trim()) {
    return "OAUTH_STATE_SIGNING_SECRET";
  }
  if (process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY?.trim()) {
    return "PROVIDER_CREDENTIAL_ENCRYPTION_KEY";
  }
  return "DEV_FALLBACK";
}

function signingSecret(): string {
  const source = oauthStateSigningSecretSource();
  if (source === "OAUTH_STATE_SIGNING_SECRET") {
    return process.env.OAUTH_STATE_SIGNING_SECRET!.trim();
  }
  if (source === "PROVIDER_CREDENTIAL_ENCRYPTION_KEY") {
    return process.env.PROVIDER_CREDENTIAL_ENCRYPTION_KEY!.trim();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OAuth state signing secret required in production (OAUTH_STATE_SIGNING_SECRET or PROVIDER_CREDENTIAL_ENCRYPTION_KEY)",
    );
  }
  return DEV_FALLBACK_SECRET;
}

function sign(body: string): string {
  return createHmac("sha256", signingSecret()).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function isDurableOauthStateStoreEnabled(): boolean {
  return (
    isSupabaseDataMode() &&
    hasSupabaseConfig() &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

export function resetOauthStateStore() {
  storeMap().clear();
}

function encodeState(payload: OAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeAndVerifyState(state: string):
  | { ok: true; payload: OAuthStatePayload; body: string }
  | { ok: false; error: string; code: string } {
  const parts = state.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { ok: false, error: "Malformed OAuth state", code: "STATE_INVALID" };
  }
  const [body, sig] = parts;
  let expectedSig: string;
  try {
    expectedSig = sign(body);
  } catch {
    return {
      ok: false,
      error: "OAuth state signing not configured",
      code: "STATE_SIGNING_UNCONFIGURED",
    };
  }
  if (!safeEqual(expectedSig, sig)) {
    return { ok: false, error: "OAuth state signature mismatch", code: "STATE_TAMPERED" };
  }
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
  } catch {
    return { ok: false, error: "OAuth state decode failed", code: "STATE_INVALID" };
  }
  if (!payload?.nonce || !payload.organizationId || !payload.provider || !payload.platform) {
    return { ok: false, error: "OAuth state incomplete", code: "STATE_INVALID" };
  }
  if (Date.now() > payload.expiresAt) {
    return { ok: false, error: "OAuth state expired", code: "STATE_EXPIRED" };
  }
  return { ok: true, payload, body };
}

/** Sync helper for unit tests / simulation memory path. */
export function createOauthState(input: {
  organizationId: string;
  provider: string;
  platform: string;
  profileId?: string | null;
  ttlMs?: number;
}): { state: string; payload: OAuthStatePayload } {
  if (!input.organizationId) {
    throw new Error("organizationId required for OAuth state");
  }
  const now = Date.now();
  const payload: OAuthStatePayload = {
    nonce: randomBytes(16).toString("hex"),
    organizationId: input.organizationId,
    provider: input.provider,
    platform: input.platform,
    profileId: input.profileId ?? null,
    issuedAt: now,
    expiresAt: now + (input.ttlMs ?? DEFAULT_TTL_MS),
  };
  storeMap().set(payload.nonce, { ...payload, consumed: false });
  return { state: encodeState(payload), payload };
}

export async function createOauthStateAsync(input: {
  organizationId: string;
  provider: string;
  platform: string;
  profileId?: string | null;
  ttlMs?: number;
}): Promise<{ state: string; payload: OAuthStatePayload }> {
  if (!isDurableOauthStateStoreEnabled()) {
    return createOauthState(input);
  }

  if (!input.organizationId) {
    throw new Error("organizationId required for OAuth state");
  }

  const now = Date.now();
  const payload: OAuthStatePayload = {
    nonce: randomBytes(16).toString("hex"),
    organizationId: input.organizationId,
    provider: input.provider,
    platform: input.platform,
    profileId: input.profileId ?? null,
    issuedAt: now,
    expiresAt: now + (input.ttlMs ?? DEFAULT_TTL_MS),
  };

  try {
    const { createSupabaseServiceClient } = await import(
      "@/infrastructure/supabase/admin"
    );
    const supabase = createSupabaseServiceClient();
    const { error } = await supabase.from("oauth_state_nonces").insert({
      nonce: payload.nonce,
      organization_id: payload.organizationId,
      profile_id: payload.profileId,
      provider: payload.provider,
      platform: payload.platform,
      issued_at: new Date(payload.issuedAt).toISOString(),
      expires_at: new Date(payload.expiresAt).toISOString(),
      consumed_at: null,
    });
    if (error) {
      logAltusError("DATABASE_ERROR", "OAuth nonce insert failed", {
        reason: error.message,
      });
      throw new Error("Unable to create OAuth state");
    }
  } catch (e) {
    logAltusError("DATABASE_ERROR", "OAuth nonce persistence unavailable", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    throw new Error("Unable to create OAuth state");
  }

  return { state: encodeState(payload), payload };
}

function consumeMemory(
  payload: OAuthStatePayload,
  opts?: { expectedOrganizationId?: string; expectedProfileId?: string | null },
):
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; error: string; code: string } {
  if (
    opts?.expectedOrganizationId &&
    opts.expectedOrganizationId !== payload.organizationId
  ) {
    return {
      ok: false,
      error: "OAuth state organization mismatch",
      code: "STATE_ORG_MISMATCH",
    };
  }
  if (
    opts?.expectedProfileId !== undefined &&
    opts.expectedProfileId !== null &&
    payload.profileId &&
    opts.expectedProfileId !== payload.profileId
  ) {
    return {
      ok: false,
      error: "OAuth state user mismatch",
      code: "STATE_USER_MISMATCH",
    };
  }

  const stored = storeMap().get(payload.nonce);
  if (!stored) {
    return {
      ok: false,
      error: "OAuth state unknown or already used",
      code: "STATE_UNKNOWN",
    };
  }
  if (stored.consumed) {
    return { ok: false, error: "OAuth state already consumed", code: "STATE_REPLAY" };
  }
  if (
    stored.organizationId !== payload.organizationId ||
    stored.provider !== payload.provider ||
    stored.platform !== payload.platform ||
    stored.profileId !== payload.profileId
  ) {
    return { ok: false, error: "OAuth state mismatch", code: "STATE_MISMATCH" };
  }
  const removed = storeMap().delete(payload.nonce);
  if (!removed) {
    return { ok: false, error: "OAuth state already consumed", code: "STATE_REPLAY" };
  }
  return { ok: true, payload };
}

/** Sync memory consume — used by unit tests. */
export function consumeOauthState(
  state: string,
  opts?: { expectedOrganizationId?: string; expectedProfileId?: string | null },
):
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; error: string; code: string } {
  const decoded = decodeAndVerifyState(state);
  if (!decoded.ok) {
    if (decoded.code === "STATE_EXPIRED") {
      // best-effort cleanup
      try {
        const payload = JSON.parse(
          Buffer.from(state.split(".")[0]!, "base64url").toString("utf8"),
        ) as OAuthStatePayload;
        if (payload?.nonce) storeMap().delete(payload.nonce);
      } catch {
        /* ignore */
      }
    }
    return decoded;
  }
  return consumeMemory(decoded.payload, opts);
}

export async function consumeOauthStateAsync(
  state: string,
  opts?: { expectedOrganizationId?: string; expectedProfileId?: string | null },
): Promise<
  | { ok: true; payload: OAuthStatePayload }
  | { ok: false; error: string; code: string }
> {
  const decoded = decodeAndVerifyState(state);
  if (!decoded.ok) return decoded;

  const payload = decoded.payload;

  if (
    opts?.expectedOrganizationId &&
    opts.expectedOrganizationId !== payload.organizationId
  ) {
    return {
      ok: false,
      error: "OAuth state organization mismatch",
      code: "STATE_ORG_MISMATCH",
    };
  }
  if (
    opts?.expectedProfileId !== undefined &&
    opts.expectedProfileId !== null &&
    payload.profileId &&
    opts.expectedProfileId !== payload.profileId
  ) {
    return {
      ok: false,
      error: "OAuth state user mismatch",
      code: "STATE_USER_MISMATCH",
    };
  }

  if (!isDurableOauthStateStoreEnabled()) {
    return consumeMemory(payload, opts);
  }

  try {
    const { createSupabaseServiceClient } = await import(
      "@/infrastructure/supabase/admin"
    );
    const supabase = createSupabaseServiceClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("oauth_state_nonces")
      .update({ consumed_at: nowIso })
      .eq("nonce", payload.nonce)
      .eq("organization_id", payload.organizationId)
      .eq("provider", payload.provider)
      .eq("platform", payload.platform)
      .is("consumed_at", null)
      .gt("expires_at", nowIso)
      .select("nonce,organization_id,profile_id,provider,platform")
      .maybeSingle();

    if (error) {
      logAltusError("DATABASE_ERROR", "OAuth nonce consume failed", {
        reason: error.message,
      });
      return {
        ok: false,
        error: "OAuth state verification unavailable",
        code: "STATE_STORE_ERROR",
      };
    }
    if (!data?.nonce) {
      return {
        ok: false,
        error: "OAuth state unknown, expired, or already used",
        code: "STATE_REPLAY",
      };
    }
    if (
      payload.profileId &&
      data.profile_id &&
      data.profile_id !== payload.profileId
    ) {
      return {
        ok: false,
        error: "OAuth state user mismatch",
        code: "STATE_USER_MISMATCH",
      };
    }
    return { ok: true, payload };
  } catch (e) {
    logAltusError("DATABASE_ERROR", "OAuth nonce consume unavailable", {
      reason: e instanceof Error ? e.message : "unknown",
    });
    return {
      ok: false,
      error: "OAuth state verification unavailable",
      code: "STATE_STORE_ERROR",
    };
  }
}

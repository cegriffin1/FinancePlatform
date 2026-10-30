/**
 * Short-lived OAuth state tokens for social connect flows.
 * HMAC-signed, org + user bound, single-use, short TTL.
 *
 * IMPORTANT (serverless):
 * Single-use replay protection uses an in-memory nonce map. That is NOT durable
 * across Vercel instances. LIVE provider redirects must remain disabled until
 * nonces are persisted (see pending migration oauth_state_nonces).
 *
 * Cryptographic integrity/expiry still work without the map; the map enforces
 * single-use on a single isolate and fails closed when the nonce is unknown
 * (safer than accepting unsigned replay across instances).
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

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

export function resetOauthStateStore() {
  storeMap().clear();
}

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
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = sign(body);
  const state = `${body}.${sig}`;
  storeMap().set(payload.nonce, { ...payload, consumed: false });
  return { state, payload };
}

/**
 * Validate + consume OAuth state.
 * Atomic same-isolate single-use via Map.delete race.
 * Unknown nonce → fail closed (STATE_UNKNOWN) — required for multi-instance safety
 * until durable nonce persistence ships.
 */
export function consumeOauthState(
  state: string,
  opts?: { expectedOrganizationId?: string; expectedProfileId?: string | null },
):
  | { ok: true; payload: OAuthStatePayload }
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
    storeMap().delete(payload.nonce);
    return { ok: false, error: "OAuth state expired", code: "STATE_EXPIRED" };
  }

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

  // Atomic consume for concurrent requests on the same isolate.
  const removed = storeMap().delete(payload.nonce);
  if (!removed) {
    return { ok: false, error: "OAuth state already consumed", code: "STATE_REPLAY" };
  }

  return { ok: true, payload };
}

/**
 * Staging durable persistence tests.
 * Runs only when ALTUS_DATA_MODE=supabase and staging project is configured.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, "");
  }
  return env;
}

const fileEnv = loadEnvLocal();
const url = (fileEnv.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
  /\/$/,
  "",
);
const isStaging = url.includes("xrxikvktrngmbiavhwlp");
const isProd = url.includes("ljglwkijdwcawckltavz");
const canRun =
  isStaging &&
  !isProd &&
  Boolean(fileEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.runIf(canRun)("durable connections on staging", () => {
  const marker = `durable_test_${Date.now()}`;
  let orgId = "";
  let connectionId = "";

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    process.env.SUPABASE_SERVICE_ROLE_KEY =
      fileEnv.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    process.env.ALTUS_DATA_MODE = "supabase";
    process.env.PROVIDER_MODE = "SIMULATION";
    process.env.ALLOW_LIVE_AD_PUBLISH = "false";

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: org } = await sb
      .from("organizations")
      .select("id,slug")
      .eq("slug", "altus")
      .maybeSingle();
    orgId = org?.id || "";
    if (!orgId) {
      const fallback = await sb.from("organizations").select("id").limit(1).maybeSingle();
      orgId = fallback.data?.id || "";
    }
    expect(orgId).toBeTruthy();
  });

  afterAll(async () => {
    if (!orgId || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    await sb
      .from("integration_connections")
      .delete()
      .eq("organization_id", orgId)
      .eq("provider", "tiktok")
      .like("display_account_name", `%${marker}%`);
    await sb
      .from("oauth_state_nonces")
      .delete()
      .eq("organization_id", orgId)
      .eq("provider", "tiktok");
  });

  it("persists connection and survives re-read (process restart simulation)", async () => {
    const { upsertDurableConnection, getDurableConnection, disconnectDurableConnection } =
      await import("@/application/integrations/IntegrationConnectionRepository");
    const { resetIntegrationStore } = await import(
      "@/application/integrations/integrationStore"
    );

    const saved = await upsertDurableConnection({
      organizationId: orgId,
      provider: "tiktok",
      accountName: `ALTUS TikTok ${marker}`,
      accountId: `tiktok_${marker}`,
      authorizedAssets: ["Advertiser: staging durable"],
      platformHint: "tiktok",
      permissionsSummary: ["user.info.basic"],
      scopes: ["user.info.basic"],
    });
    connectionId = saved.id;
    expect(saved.credential_ref).toBeTruthy();
    expect(JSON.stringify(saved)).toMatch(/credential_ref/);

    // Clear memory — simulate new serverless isolate
    resetIntegrationStore();

    const reloaded = await getDurableConnection(orgId, "tiktok");
    expect(reloaded?.id).toBe(connectionId);
    expect(reloaded?.display_account_name).toContain(marker);
    expect(reloaded?.authorized_assets?.length).toBeGreaterThan(0);
    expect(reloaded?.credential_ref).toBeTruthy();

    // Public view must not expose credential_ref
    const { publicConnectionView } = await import(
      "@/application/integrations/integrationStore"
    );
    const pub = publicConnectionView(reloaded!);
    expect(pub).not.toHaveProperty("credential_ref");
    expect(JSON.stringify(pub)).not.toMatch(/sim_access_|access_token/);

    const cross = await disconnectDurableConnection({
      organizationId: "00000000-0000-4000-8000-000000000099",
      provider: "tiktok",
      connectionId,
    });
    expect(cross.ok).toBe(false);

    const ok = await disconnectDurableConnection({
      organizationId: orgId,
      provider: "tiktok",
      connectionId,
    });
    expect(ok.ok).toBe(true);

    resetIntegrationStore();
    const after = await getDurableConnection(orgId, "tiktok");
    // Soft disconnect → status disconnected / null for UI
    expect(
      !after || after.status === "disconnected" || after.status === "NOT_CONNECTED",
    ).toBe(true);
    expect(after?.credential_ref || "").toBe("");
  });

  it("atomically consumes durable OAuth nonces (concurrent + replay)", async () => {
    const { createOauthStateAsync, consumeOauthStateAsync, resetOauthStateStore } =
      await import("@/application/integrations/oauthStateStore");
    resetOauthStateStore();

    const { state } = await createOauthStateAsync({
      organizationId: orgId,
      provider: "tiktok",
      platform: "tiktok",
      profileId: null,
      ttlMs: 120_000,
    });

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        consumeOauthStateAsync(state, { expectedOrganizationId: orgId }),
      ),
    );
    const wins = results.filter((r) => r.ok);
    const losses = results.filter((r) => !r.ok);
    expect(wins).toHaveLength(1);
    expect(losses.length).toBe(11);

    const replay = await consumeOauthStateAsync(state, {
      expectedOrganizationId: orgId,
    });
    expect(replay.ok).toBe(false);
  });

  it("rejects expired durable OAuth state", async () => {
    const { createOauthStateAsync, consumeOauthStateAsync } = await import(
      "@/application/integrations/oauthStateStore"
    );
    const { state } = await createOauthStateAsync({
      organizationId: orgId,
      provider: "tiktok",
      platform: "tiktok",
      ttlMs: -1000,
    });
    const result = await consumeOauthStateAsync(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("STATE_EXPIRED");
  });

  it("does not expose oauth_state_nonces to anon clients", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { error } = await anon.from("oauth_state_nonces").select("nonce").limit(1);
    expect(error?.message || "").toMatch(/permission denied|row-level security/i);
  });
});

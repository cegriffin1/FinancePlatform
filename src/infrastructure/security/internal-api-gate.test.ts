import { afterEach, describe, expect, it, vi } from "vitest";

describe("enforceInternalApiAccess", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.unmock("@/infrastructure/supabase/server");
    vi.unmock("@/lib/env");
  });

  it("allows access in non-production by default", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ALTUS_ALLOW_UNAUTHENTICATED_SIM", "");
    const { enforceInternalApiAccess } = await import(
      "@/infrastructure/security/internalApiGate"
    );
    await expect(enforceInternalApiAccess()).resolves.toBeNull();
  });

  it("allows access when ALTUS_ALLOW_UNAUTHENTICATED_SIM=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALTUS_ALLOW_UNAUTHENTICATED_SIM", "true");
    const { enforceInternalApiAccess } = await import(
      "@/infrastructure/security/internalApiGate"
    );
    await expect(enforceInternalApiAccess()).resolves.toBeNull();
  });

  it("returns 503 in production when Supabase is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALTUS_ALLOW_UNAUTHENTICATED_SIM", "");
    vi.doMock("@/lib/env", () => ({
      hasSupabaseConfig: () => false,
      getEnv: () => ({}),
    }));
    const { enforceInternalApiAccess } = await import(
      "@/infrastructure/security/internalApiGate"
    );
    const res = await enforceInternalApiAccess();
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
    const body = await res!.json();
    expect(body.code).toBe("AUTH_NOT_CONFIGURED");
  });
});

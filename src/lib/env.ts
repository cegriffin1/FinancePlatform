import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal("")),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  USE_MOCK_PROVIDERS: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  PROVIDER_MODE: z.enum(["SIMULATION", "LIVE"]).default("SIMULATION"),
  ALLOW_LIVE_AD_PUBLISH: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Durable persistence mode. Pilot/production must use supabase. */
  ALTUS_DATA_MODE: z.enum(["simulation", "supabase"]).default("simulation"),
  ALTUS_ALLOW_UNAUTHENTICATED_SIM: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /**
   * Highwater public consumer launch.
   * Absent / anything other than "open" = fail-closed (anonymous denied).
   * Authorized ALTUS org members may still test when closed.
   */
  HIGHWATER_PUBLIC_LAUNCH: z.enum(["open", "closed"]).optional(),
  /** Org slug allowed to test while launch gate is closed (default altus). */
  HIGHWATER_LAUNCH_TESTER_ORG_SLUG: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    USE_MOCK_PROVIDERS: process.env.USE_MOCK_PROVIDERS ?? "false",
    PROVIDER_MODE: process.env.PROVIDER_MODE ?? "SIMULATION",
    ALLOW_LIVE_AD_PUBLISH: process.env.ALLOW_LIVE_AD_PUBLISH ?? "false",
    ALTUS_DATA_MODE: process.env.ALTUS_DATA_MODE ?? "simulation",
    ALTUS_ALLOW_UNAUTHENTICATED_SIM:
      process.env.ALTUS_ALLOW_UNAUTHENTICATED_SIM === "true" ? "true" : "false",
    HIGHWATER_PUBLIC_LAUNCH:
      process.env.HIGHWATER_PUBLIC_LAUNCH === "open"
        ? "open"
        : process.env.HIGHWATER_PUBLIC_LAUNCH === "closed"
          ? "closed"
          : undefined,
    HIGHWATER_LAUNCH_TESTER_ORG_SLUG:
      process.env.HIGHWATER_LAUNCH_TESTER_ORG_SLUG || undefined,
  });
}

export function hasSupabaseConfig(): boolean {
  const env = getEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

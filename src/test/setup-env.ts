/**
 * Deterministic Vitest environment.
 * Clears developer Supabase credentials inherited from the process/.env.local
 * so unit tests stay in simulation mode unless a test stubs otherwise.
 */
const CLEAR = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

for (const key of CLEAR) {
  delete process.env[key];
  process.env[key] = "";
}

process.env.ALTUS_DATA_MODE = "simulation";
process.env.ALTUS_ALLOW_UNAUTHENTICATED_SIM = "false";

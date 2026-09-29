import { getEnv } from "@/lib/env";

export type AltusDataMode = "simulation" | "supabase";

/**
 * Central data-mode resolution. Do not scatter env checks in React components.
 *
 * Rules:
 * - Default: simulation (tests/demo/local)
 * - Pilot/production: set ALTUS_DATA_MODE=supabase
 * - Production never silently falls back to simulation when Supabase fails
 */
export function getDataMode(): AltusDataMode {
  const mode = getEnv().ALTUS_DATA_MODE;
  return mode === "supabase" ? "supabase" : "simulation";
}

export function isSupabaseDataMode(): boolean {
  return getDataMode() === "supabase";
}

export function isSimulationDataMode(): boolean {
  return getDataMode() === "simulation";
}

/** Thrown when supabase mode is required but unavailable. */
export class DataModeError extends Error {
  readonly code = "DATABASE_ERROR" as const;
  constructor(message: string) {
    super(message);
    this.name = "DataModeError";
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server";
import { hasSupabaseConfig } from "@/lib/env";

/**
 * Fail-closed gate for internal (non-public) APIs.
 *
 * Development / test: open by default so sim-store workspace keeps working.
 * Production: requires a real Supabase session unless explicitly opted out.
 *
 * Opt-out (local/demo only): ALTUS_ALLOW_UNAUTHENTICATED_SIM=true
 *
 * This does NOT implement roles/permissions — it only stops anonymous
 * dumps of leads/campaigns/CRM when the app is deployed.
 */
export async function enforceInternalApiAccess(): Promise<NextResponse | null> {
  if (process.env.ALTUS_ALLOW_UNAUTHENTICATED_SIM === "true") {
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json(
      {
        error:
          "Internal APIs are locked in production until Supabase auth is configured.",
        code: "AUTH_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json(
        { error: "Authentication required", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Authentication unavailable", code: "AUTH_ERROR" },
      { status: 503 },
    );
  }

  return null;
}

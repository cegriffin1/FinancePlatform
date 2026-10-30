import { NextResponse } from "next/server";
import { currentUserIsAuthorizedHighwaterLaunchTester } from "@/infrastructure/security/highwaterLaunchTester";
import {
  isPublicConsumerLaunchOpen,
  LAUNCH_GATE_CLOSED_CODE,
} from "@/lib/launchGate";

const CLOSED_MESSAGE =
  "Highwater Capital consumer intake is not publicly available yet.";

/**
 * Fail-closed gate for anonymous Highwater / public consumer intake.
 *
 * - HIGHWATER_PUBLIC_LAUNCH=open → allow
 * - otherwise → require an authorized ALTUS org member (active membership +
 *   system role in HIGHWATER_LAUNCH_TESTER_ORG_SLUG, default "altus")
 *
 * A valid Supabase login alone is insufficient.
 * No query-string secrets, no IP allowlists, no client-only checks.
 * Does not affect authenticated ALTUS dashboard routes.
 */
export async function enforcePublicConsumerLaunchGate(): Promise<NextResponse | null> {
  if (isPublicConsumerLaunchOpen()) {
    return null;
  }

  const authorized = await currentUserIsAuthorizedHighwaterLaunchTester();
  if (!authorized) {
    return NextResponse.json(
      {
        error: CLOSED_MESSAGE,
        code: LAUNCH_GATE_CLOSED_CODE,
      },
      { status: 403 },
    );
  }

  return null;
}

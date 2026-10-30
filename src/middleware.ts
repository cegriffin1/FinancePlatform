import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { PASSWORD_SETUP_COOKIE } from "@/lib/auth/password-setup";
import { userIsAuthorizedHighwaterLaunchTester } from "@/infrastructure/security/highwaterLaunchTester";
import {
  isPublicConsumerApiPath,
  isPublicConsumerLaunchOpen,
  isPublicConsumerPath,
  LAUNCH_GATE_CLOSED_CODE,
} from "@/lib/launchGate";

/**
 * Session refresh + internal route protection + Highwater launch gate.
 * Soft-no-op when Supabase env is absent (local UI without credentials),
 * except public consumer paths remain fail-closed unless explicitly open.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const { pathname } = request.nextUrl;

  const isInternal =
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/setter") ||
    pathname.startsWith("/marketplace") ||
    pathname.startsWith("/leads");

  const consumerPath = isPublicConsumerPath(pathname);
  const launchOpen = isPublicConsumerLaunchOpen();

  if (!url || !anon) {
    // Without Supabase config, keep local simulation workspace usable,
    // but never open anonymous consumer intake unless explicitly allowed.
    if (consumerPath && !launchOpen) {
      if (isPublicConsumerApiPath(pathname)) {
        return NextResponse.json(
          {
            error:
              "Highwater Capital consumer intake is not publicly available yet.",
            code: LAUNCH_GATE_CLOSED_CODE,
          },
          { status: 403 },
        );
      }
      const unavailable = request.nextUrl.clone();
      unavailable.pathname = "/assessment/unavailable";
      return NextResponse.rewrite(unavailable);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: {
          name: string;
          value: string;
          options?: Record<string, unknown>;
        }[],
      ) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fail-closed Highwater / public consumer gate (server-side).
  // Only active members of the configured tester org (default altus)
  // with a system role may test while closed. Bare login is insufficient.
  if (consumerPath && !launchOpen) {
    const authorized = await userIsAuthorizedHighwaterLaunchTester(user);
    if (!authorized) {
      if (isPublicConsumerApiPath(pathname)) {
        return NextResponse.json(
          {
            error:
              "Highwater Capital consumer intake is not publicly available yet.",
            code: LAUNCH_GATE_CLOSED_CODE,
          },
          { status: 403 },
        );
      }
      const unavailable = request.nextUrl.clone();
      unavailable.pathname = "/assessment/unavailable";
      return NextResponse.rewrite(unavailable);
    }
  }

  const passwordSetupPending =
    request.cookies.get(PASSWORD_SETUP_COOKIE)?.value === "1";

  // Invite/recovery sessions must finish password setup before workspace access.
  if (
    user &&
    passwordSetupPending &&
    !pathname.startsWith("/auth/set-password") &&
    !pathname.startsWith("/auth/callback") &&
    !pathname.startsWith("/auth/password-setup") &&
    !pathname.startsWith("/auth/error")
  ) {
    return NextResponse.redirect(new URL("/auth/set-password", request.url));
  }

  if (isInternal && !user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === "/login" && user) {
    if (passwordSetupPending) {
      return NextResponse.redirect(new URL("/auth/set-password", request.url));
    }
    return NextResponse.redirect(new URL("/app", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|__next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

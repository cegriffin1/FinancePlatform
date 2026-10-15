import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { PASSWORD_SETUP_COOKIE } from "@/lib/auth/password-setup";

/**
 * Session refresh + internal route protection.
 * Public marketing/assessment routes remain open.
 * Soft-no-op when Supabase env is absent (local UI without credentials).
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

  if (!url || !anon) {
    // Without Supabase config, allow local simulation workspace
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

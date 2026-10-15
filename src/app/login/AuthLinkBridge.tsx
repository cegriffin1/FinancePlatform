"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";

/**
 * Handles invite/recovery links that landed on /login (legacy redirectTo).
 * - PKCE `?code=` → /auth/callback
 * - Hash tokens (`#access_token` / type=invite|recovery) → establish session → set-password
 * Never logs URL secrets.
 */
export function AuthLinkBridge({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const typeQ = url.searchParams.get("type");

    if (code || (tokenHash && typeQ)) {
      setStatus("Verifying your invitation…");
      const dest = new URL("/auth/callback", window.location.origin);
      url.searchParams.forEach((value, key) => {
        dest.searchParams.set(key, value);
      });
      if (!dest.searchParams.get("next")) {
        dest.searchParams.set("next", "/auth/set-password");
      }
      window.location.replace(dest.toString());
      return;
    }

    const hash = window.location.hash?.replace(/^#/, "") ?? "";
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const type = params.get("type");
    const accessToken = params.get("access_token");
    if (!accessToken && !type) return;

    let cancelled = false;
    (async () => {
      setStatus("Completing invitation…");
      try {
        const supabase = createSupabaseBrowserClient();
        // createBrowserClient detects session from URL hash when present
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error || !data.session) {
          setStatus(null);
          return;
        }

        // Clear secrets from the address bar without exposing them
        window.history.replaceState({}, "", "/login");

        await fetch("/auth/password-setup/arm", { method: "POST" });
        router.replace("/auth/set-password");
      } catch {
        if (!cancelled) setStatus(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, router]);

  if (!status) return null;
  return (
    <p className="mb-4 text-sm text-[var(--ink-muted)]" role="status">
      {status}
    </p>
  );
}

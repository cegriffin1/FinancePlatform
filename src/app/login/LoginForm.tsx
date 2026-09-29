"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";
import { Button } from "@/components/ui/Button";

export function LoginForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError("Supabase is not configured. Set environment variables first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      router.replace("/app");
      router.refresh();
    } catch {
      setError("Unable to sign in. Please try again.");
      setLoading(false);
    }
  }

  async function onSignOut() {
    if (!configured) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <label className="block space-y-1 text-sm font-semibold">
          Email
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          Password
          <input
            required
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
          />
        </label>
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading || !configured} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="ghost"
          disabled={!configured || signingOut}
          onClick={() => void onSignOut()}
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
        <Link href="/">
          <Button variant="ghost">Back</Button>
        </Link>
      </div>
    </div>
  );
}

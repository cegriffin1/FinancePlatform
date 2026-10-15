"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/infrastructure/supabase/client";
import { passwordMeetsPolicy } from "@/lib/auth/password-setup";
import { Button } from "@/components/ui/Button";

export function SetPasswordForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setError("Supabase is not configured.");
      return;
    }
    setError(null);

    const policy = passwordMeetsPolicy(password);
    if (!policy.ok) {
      setError(policy.message ?? "Invalid password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError(
          "This password setup link has expired or was already used. Request a new link from the sign-in page.",
        );
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError("Unable to save password. Try a different password or request a new link.");
        setLoading(false);
        return;
      }

      await fetch("/auth/password-setup/complete", { method: "POST" });
      await supabase.auth.signOut();
      router.replace("/login?password_set=1");
      router.refresh();
    } catch {
      setError("Unable to save password. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
      <label className="block space-y-1 text-sm font-semibold">
        New password
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
        />
      </label>
      <label className="block space-y-1 text-sm font-semibold">
        Confirm password
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading || !configured} className="w-full">
        {loading ? "Saving…" : "Save password"}
      </Button>
    </form>
  );
}

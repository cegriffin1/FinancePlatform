import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { hasSupabaseConfig } from "@/lib/env";

export default function LoginPage() {
  const configured = hasSupabaseConfig();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <Card className="w-full">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Authentication
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">
          Sign in
        </h1>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Auth is wired through Supabase Auth abstractions. Configure environment
          variables, then connect your preferred sign-in method (magic link or
          password).
        </p>
        <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-sm">
          Status:{" "}
          <strong>{configured ? "Supabase keys detected" : "Env not configured"}</strong>
        </div>
        <div className="mt-6 flex gap-3">
          <Link href="/app">
            <Button>Continue to shell</Button>
          </Link>
          <Link href="/">
            <Button variant="ghost">Back</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

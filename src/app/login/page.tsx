import { Card } from "@/components/ui/Card";
import { hasSupabaseConfig } from "@/lib/env";
import { LoginForm } from "@/app/login/LoginForm";

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
          Sign in with your ALTUS organization credentials to access the workspace.
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/70 p-4 text-sm">
          Status:{" "}
          <strong>
            {configured ? "Supabase configured" : "Env not configured"}
          </strong>
        </div>
        <div className="mt-6">
          <LoginForm configured={configured} />
        </div>
      </Card>
    </div>
  );
}

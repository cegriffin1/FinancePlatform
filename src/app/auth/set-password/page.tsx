import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { hasSupabaseConfig } from "@/lib/env";
import { SetPasswordForm } from "@/app/auth/set-password/SetPasswordForm";

export default function SetPasswordPage() {
  const configured = hasSupabaseConfig();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <Card className="w-full">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Account setup
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">
          Create your password
        </h1>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">
          Choose a strong unique password for your ALTUS account. You will sign
          in with email and this password afterward.
        </p>
        <div className="mt-6">
          <SetPasswordForm configured={configured} />
        </div>
        <p className="mt-6 text-sm text-[var(--ink-muted)]">
          Link expired?{" "}
          <Link className="underline" href="/login">
            Request a new password setup email
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}

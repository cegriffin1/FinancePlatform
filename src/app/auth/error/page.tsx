import Link from "next/link";
import { Card } from "@/components/ui/Card";

const REASONS: Record<string, string> = {
  not_configured: "Authentication is not configured for this environment.",
  exchange_failed: "This sign-in link is invalid or has expired.",
  verify_failed: "This invitation or recovery link is invalid or has expired.",
  missing_token: "No invitation or recovery token was found in the link.",
  unexpected: "Something went wrong while verifying your link.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason || "unexpected";
  const message = REASONS[reason] ?? REASONS.unexpected;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <Card className="w-full">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Authentication
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl">
          Link could not be verified
        </h1>
        <p className="mt-3 text-sm text-[var(--ink-muted)]">{message}</p>
        <p className="mt-6 text-sm">
          <Link className="underline" href="/login">
            Return to sign in
          </Link>{" "}
          and request a new password setup email.
        </p>
      </Card>
    </div>
  );
}

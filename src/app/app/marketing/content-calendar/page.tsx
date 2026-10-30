import Link from "next/link";

export default function ContentCalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app/marketing"
          className="text-sm font-semibold text-[var(--altus-blue)]"
        >
          ← Marketing
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--altus-text)]">
          Content Calendar
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--altus-text-secondary)]">
          Plan organic posts across Facebook, Instagram, TikTok, and LinkedIn.
          Scheduling and publishing are placeholders until provider Content APIs
          are connected, approved, and tested. No posts will be published from
          this screen today.
        </p>
      </div>

      <div className="rounded-[12px] border border-dashed border-[var(--altus-border)] bg-white p-8 text-center shadow-[var(--altus-shadow)]">
        <p className="text-sm font-semibold text-[var(--altus-text)]">
          Calendar UI shell — not operational
        </p>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Connect accounts first, then enable organic publish scopes per platform.
        </p>
        <Link
          href="/app/marketing/connected-accounts"
          className="mt-4 inline-flex rounded-md bg-[var(--altus-blue)] px-3 py-1.5 text-xs font-semibold text-white"
        >
          Open Connected Accounts
        </Link>
      </div>
    </div>
  );
}

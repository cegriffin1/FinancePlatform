import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--altus-text)]">Settings</h1>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          Organization branding, membership, roles, and integration connections.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/settings/integrations"
          className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5"
        >
          <h2 className="text-lg font-bold text-[var(--altus-text)]">Marketing Integrations</h2>
          <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
            Connect Meta, LinkedIn, and Google Ads accounts securely.
          </p>
        </Link>
      </div>
    </div>
  );
}

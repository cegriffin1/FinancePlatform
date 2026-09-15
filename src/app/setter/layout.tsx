import type { PropsWithChildren } from "react";
import Link from "next/link";

export default function SetterLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[var(--altus-bg,#f6f8fb)]">
      <header className="border-b border-[var(--altus-border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/setter" className="text-lg font-bold text-[var(--altus-blue)]">
              ALTUS Setter
            </Link>
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Quality control
            </span>
          </div>
          <Link
            href="/app/leads"
            className="text-sm font-semibold text-[var(--altus-text-secondary)]"
          >
            Agent CRM →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

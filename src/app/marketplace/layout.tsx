import type { PropsWithChildren } from "react";
import Link from "next/link";

export default function MarketplaceLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[var(--altus-bg,#f6f8fb)]">
      <header className="border-b border-[var(--altus-border)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/marketplace" className="text-lg font-bold text-[var(--altus-blue)]">
            ALTUS Marketplace
          </Link>
          <div className="flex gap-4 text-sm font-semibold">
            <Link href="/admin/lead-inventory">Inventory Admin</Link>
            <Link href="/app">Agent CRM</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

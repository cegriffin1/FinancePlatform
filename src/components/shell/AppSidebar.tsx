"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAV } from "@/lib/navigation";
import { cn } from "@/lib/cn";

export function AppSidebar({ orgName }: { orgName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--bg-elevated)]/90 px-4 py-6 backdrop-blur">
      <div className="mb-8 px-2">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          ALTUS
        </p>
        <h1 className="mt-2 font-semibold text-xl leading-none tracking-tight">
          {orgName ?? "Your organization"}
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        {APP_NAV.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                  : "text-[var(--ink-muted)] hover:bg-black/3 hover:text-[var(--ink)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="px-2 text-xs text-[var(--ink-muted)]">
        Multi-tenant foundation · permission-aware
      </p>
    </aside>
  );
}

import type { PropsWithChildren } from "react";
import { AppSidebar } from "@/components/shell/AppSidebar";

export function AppShell({
  children,
  orgName,
  userLabel,
}: PropsWithChildren<{ orgName?: string; userLabel?: string }>) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar orgName={orgName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[var(--line)] px-8 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--ink-muted)]">
              Workspace
            </p>
            <p className="text-sm text-[var(--ink)]">
              {userLabel ?? "Signed out · configure Supabase to authenticate"}
            </p>
          </div>
        </header>
        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

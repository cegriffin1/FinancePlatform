import type { PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  children,
  className,
}: PropsWithChildren<{
  title: string;
  description: string;
  className?: string;
}>) {
  return (
    <div
      className={cn(
        "flex min-h-56 flex-col items-start justify-center gap-3 rounded-[var(--radius)] border border-dashed border-[var(--line)] bg-white/50 p-8",
        className,
      )}
    >
      <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
        {title}
      </h2>
      <p className="max-w-xl text-[var(--ink-muted)]">{description}</p>
      {children}
    </div>
  );
}

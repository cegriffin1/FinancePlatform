import type { PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius)] border border-[var(--line)] bg-[var(--bg-elevated)] p-6 shadow-[var(--shadow)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

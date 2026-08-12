import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost";
  }
>;

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--accent)] text-white shadow-sm hover:brightness-110",
        variant === "secondary" &&
          "border border-[var(--line)] bg-[var(--bg-elevated)] text-[var(--ink)] hover:bg-white",
        variant === "ghost" && "text-[var(--ink-muted)] hover:text-[var(--ink)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

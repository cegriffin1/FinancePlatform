import { cn } from "@/lib/cn";

/** Simple wordmark mark for Highwater Capital consumer surfaces. */
export function HighwaterMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("text-[var(--altus-blue)]", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M7 20.5c2.2-3.4 4.1-5.2 6.2-5.2 1.6 0 2.7 1.1 3.8 2.7 1.2 1.7 2.5 2.7 4.1 2.7 1.8 0 3.4-1.3 4.9-3.7"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

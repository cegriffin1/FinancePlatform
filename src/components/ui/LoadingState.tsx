export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-40 items-center gap-3 text-[var(--ink-muted)]"
      role="status"
      aria-live="polite"
    >
      <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
      {label}
    </div>
  );
}

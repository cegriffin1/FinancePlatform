import type { PropsWithChildren } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function PlaceholderPage({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-muted)]">{description}</p>
      </div>
      <Card>
        <EmptyState title={`${title} is ready for depth`} description={description}>
          {children}
        </EmptyState>
      </Card>
    </div>
  );
}

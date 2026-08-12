import { Card } from "@/components/ui/Card";

const journey = [
  "Organization signup",
  "Invite employee",
  "Create campaign",
  "Capture & score lead",
  "Route & work pipeline",
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight">
          Home
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--ink-muted)]">
          Foundation shell for the Growth OS. Feature depth lands through subsequent
          vertical slices — starting with organization onboarding.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            First vertical slice
          </h2>
          <ol className="mt-5 space-y-3">
            {journey.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-medium text-[var(--accent)]">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            Platform status
          </h2>
          <ul className="mt-5 space-y-3 text-sm text-[var(--ink-muted)]">
            <li>Domain interfaces defined</li>
            <li>Permission model seeded in schema</li>
            <li>RLS baseline ready to apply</li>
            <li>Microsoft adapters documented, not implemented</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

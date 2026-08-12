import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { hasSupabaseConfig } from "@/lib/env";

export default function HomePage() {
  const configured = hasSupabaseConfig();

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-10 px-6 py-16">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-muted)]">
          Growth Operating System
        </p>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight md:text-6xl">
          From campaign to close — built for teams, not just CRMs.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-[var(--ink-muted)]">
          Multi-tenant foundation for marketing, lead scoring, routing, pipeline,
          and retention. Industry-neutral core with Advanced Markets as the first
          accelerator.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/app">
            <Button>Open workspace</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Tenant isolation
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Organization-scoped data with Supabase RLS and server-side permission
            checks.
          </p>
        </Card>
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Adapter-ready
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Domain interfaces keep Dynamics 365 / Dataverse replaceable without UI
            rewrites.
          </p>
        </Card>
        <Card>
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            Setup status
          </h2>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Supabase env:{" "}
            <span className="font-medium text-[var(--ink)]">
              {configured ? "configured" : "missing — copy .env.example"}
            </span>
          </p>
        </Card>
      </div>
    </div>
  );
}

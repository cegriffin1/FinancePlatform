"use client";

import {
  EDUCATION_VS_ADVICE_DISCLAIMER,
  HIGHWATER_BRAND,
  HIGHWATER_LITERATURE_CARDS,
} from "@/domain/brand/highwater";

export type ConsumerProfileSummary = {
  primary_goal: string | null;
  retirement_timeline: string | null;
  important_priorities: string[];
  planning_horizon: string | null;
  repositionable_band: string | null;
};

export function HighwaterResultsPanel({
  profile,
  children,
}: {
  profile: ConsumerProfileSummary;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-[18px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)] md:p-8">
        <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
          {HIGHWATER_BRAND.name.toUpperCase()}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--altus-text)]">
          Your educational retirement summary
        </h2>
        <p className="mt-2 text-sm text-[var(--altus-text-secondary)]">
          {HIGHWATER_BRAND.positioning}
        </p>
        <p className="mt-4 rounded-[12px] bg-[var(--altus-soft)] px-4 py-3 text-xs leading-relaxed text-[var(--altus-text-secondary)]">
          {EDUCATION_VS_ADVICE_DISCLAIMER}
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Primary goal
            </dt>
            <dd className="mt-1 text-base font-bold">{profile.primary_goal ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Retirement timeline
            </dt>
            <dd className="mt-1 text-base font-bold">
              {profile.retirement_timeline ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Potentially repositionable
            </dt>
            <dd className="mt-1 text-base font-bold">
              {profile.repositionable_band ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Planning timeline
            </dt>
            <dd className="mt-1 text-base font-bold">
              {profile.planning_horizon ?? "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--altus-text-secondary)]">
              Important priorities
            </dt>
            <dd className="mt-1 space-y-1 text-sm font-semibold">
              {profile.important_priorities.length
                ? profile.important_priorities.map((p) => <div key={p}>{p}</div>)
                : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-[18px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)] md:p-8">
        <h3 className="text-lg font-bold text-[var(--altus-text)]">
          Educational literature
        </h3>
        <p className="mt-1 text-sm text-[var(--altus-text-secondary)]">
          General resources to help you prepare — not personalized recommendations.
        </p>
        <ul className="mt-5 grid gap-3">
          {HIGHWATER_LITERATURE_CARDS.map((card) => (
            <li
              key={card.id}
              className="rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-soft)] px-4 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--altus-blue)]">
                {card.category}
              </p>
              <p className="mt-1 text-sm font-bold text-[var(--altus-text)]">
                {card.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-[var(--altus-text-secondary)]">
                {card.summary}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {children}
    </section>
  );
}

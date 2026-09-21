"use client";

import { FormEvent, useState } from "react";
import { Bookmark } from "lucide-react";
import { AltusContainer } from "@/components/altus/AltusContainer";
import { cn } from "@/lib/cn";

const QUICK = [
  "Where do I start?",
  "How can I reduce taxes?",
  "How do I retain key employees?",
  "How do I grow business value?",
];

export function AltusHero() {
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState(false);

  function onSearch(e: FormEvent) {
    e.preventDefault();
  }

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(145deg,var(--altus-hero-from)_0%,#005fa8_48%,var(--altus-hero-to)_100%)]">
      <AltusContainer className="relative grid items-start gap-8 pb-16 pt-10 md:grid-cols-[0.92fr_1.08fr] md:gap-10 md:pb-20 md:pt-12 lg:gap-12">
        <div className="text-white md:pt-2">
          <span className="inline-flex rounded-full border border-white/35 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.06em]">
            FREE • NO ACCOUNT REQUIRED
          </span>
          <h1 className="mt-5 max-w-[20ch] text-[2rem] font-bold leading-[1.15] tracking-[-0.02em] md:text-[2.35rem] lg:text-[2.55rem]">
            Your complete guide to growing a stronger business.
          </h1>
          <p className="mt-4 max-w-[40ch] text-[14px] leading-relaxed text-white/90 md:text-[15px]">
            No pressure. No complicated financial language. Just clear insights,
            practical resources, and personalized guidance designed around your
            business.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#retirement-assessment"
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-5 py-2.5 text-[13px] font-semibold text-[var(--altus-blue)] transition hover:bg-white/95"
            >
              Start Assessment
            </a>
            <a
              href="#growth-hub"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-white/50 bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/20"
            >
              Explore Growth Hub
            </a>
          </div>

          <form
            onSubmit={onSearch}
            className="mt-5 flex max-w-xl overflow-hidden rounded-full bg-white p-1 shadow-[0_8px_24px_rgba(3,38,61,0.18)]"
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search strategies, guides, ideas, calculators..."
              className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[13px] text-[var(--altus-text)] outline-none placeholder:text-[var(--altus-text-secondary)]"
              aria-label="Search ALTUS resources"
            />
            <button
              type="submit"
              className="rounded-full bg-[var(--altus-blue)] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--altus-blue-deep)]"
            >
              Search
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setQuery(item)}
                className="rounded-full border border-white/45 bg-white/5 px-3 py-1.5 text-[12px] text-white/95 transition hover:bg-white/15"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 md:-mb-10 md:pt-1 lg:-mb-12">
          <article className="overflow-hidden rounded-[12px] border border-white/20 bg-white shadow-[0_16px_40px_rgba(3,38,61,0.22)]">
            <div className="relative aspect-[16/10] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1200&q=80"
                alt="Business leaders collaborating on growth planning"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label={saved ? "Remove bookmark" : "Save resource"}
                onClick={() => setSaved((v) => !v)}
                className={cn(
                  "absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm transition",
                  saved ? "text-[var(--altus-blue)]" : "text-[var(--altus-text-secondary)]",
                )}
              >
                <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
              </button>
            </div>
            <div className="px-5 pb-2 pt-4">
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--altus-blue)]">
                BUSINESS GROWTH
              </p>
              <h2 className="mt-1 text-[1.15rem] font-bold leading-snug text-[var(--altus-text)]">
                Build a Stronger Financial Foundation
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--altus-text-secondary)]">
                A practical path to clarify cash flow, protection, growth, and
                succession priorities for your business.
              </p>
            </div>
            <div className="border-t border-[var(--altus-border)] px-5 py-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[12px] font-medium text-[var(--altus-text-secondary)]">
                    Growth Readiness
                  </p>
                  <p className="text-[1.75rem] font-bold leading-none text-[var(--altus-text)]">
                    82%
                  </p>
                </div>
                <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  {[
                    { label: "Cash Flow", value: 78 },
                    { label: "Protection", value: 71 },
                    { label: "Growth", value: 86 },
                    { label: "Succession", value: 64 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex justify-between text-[10px] text-[var(--altus-text-secondary)]">
                        <span>{item.label}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--altus-soft)]">
                        <div
                          className="h-full rounded-full bg-[var(--altus-blue)]"
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>
        </div>
      </AltusContainer>
    </section>
  );
}

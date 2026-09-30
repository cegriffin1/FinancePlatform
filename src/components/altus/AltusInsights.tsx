"use client";

import { useState } from "react";
import { AltusContainer } from "@/components/altus/AltusContainer";
import { BookmarkIcon } from "@/components/altus/BookmarkIcon";
import { cn } from "@/lib/cn";

const FILTERS = ["All", "Articles", "Videos", "Guides"] as const;

const ARTICLES = [
  {
    title: "How Much Working Capital Does Your Business Really Need?",
    category: "Cash Flow",
    read: "5 min read",
    image:
      "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "What Happens If a Key Employee Leaves Tomorrow?",
    category: "Protection",
    read: "6 min read",
    image:
      "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Business Succession: When Should You Start Planning?",
    category: "Succession",
    read: "7 min read",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Are You Building Revenue or Building Business Value?",
    category: "Growth",
    read: "5 min read",
    image:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=800&q=80",
  },
];

export function AltusInsights() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  return (
    <section id="insights" className="bg-[var(--altus-section)] py-10 md:py-12">
      <AltusContainer>
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-[1.6rem] font-bold tracking-tight text-[var(--altus-text)] md:text-[1.75rem]">
              Financial Insights
            </h2>
            <p className="mt-1 max-w-2xl text-[14px] text-[var(--altus-text-secondary)]">
              Articles, guides, calculators, and videos — practical financial
              education for business owners.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-semibold transition",
                  filter === item
                    ? "bg-[var(--altus-blue)] text-white"
                    : "border border-[var(--altus-border)] bg-white text-[var(--altus-text-secondary)] hover:border-[var(--altus-blue)]/40",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="overflow-hidden rounded-[12px] border border-[var(--altus-border-strong)] bg-white shadow-[var(--altus-shadow)]">
            <div className="relative aspect-[16/11]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1400&q=80"
                alt="Executive reviewing financial strategy materials"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-3 top-3 rounded-md bg-[var(--altus-blue)] px-2 py-1 text-[10px] font-bold tracking-wide text-white">
                FEATURED GUIDE
              </span>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-[var(--altus-blue)]">
                Business Growth
              </p>
              <h3 className="mt-2 text-[1.25rem] font-bold leading-snug text-[var(--altus-text)]">
                7 Financial Blind Spots Growing Businesses Often Miss
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--altus-text-secondary)]">
                A practical guide to identifying overlooked financial risks and
                growth opportunities.
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[12px] text-[var(--altus-text-secondary)]">
                  8 min read
                </span>
                <a
                  href="#resources"
                  className="text-[13px] font-semibold text-[var(--altus-blue)] hover:underline"
                >
                  Read guide →
                </a>
              </div>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2">
            {ARTICLES.map((article) => (
              <article
                key={article.title}
                className="group overflow-hidden rounded-[10px] border border-[var(--altus-border-strong)] bg-white shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--altus-shadow-hover)]"
              >
                <div className="relative aspect-[16/10]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={article.image}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Save article"
                    className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[var(--altus-text-secondary)] shadow-sm"
                  >
                    <BookmarkIcon size={14} />
                  </button>
                </div>
                <div className="p-3.5">
                  <span className="inline-flex rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--altus-blue)]">
                    {article.category}
                  </span>
                  <h4 className="mt-2 text-[13px] font-bold leading-snug text-[var(--altus-text)]">
                    {article.title}
                  </h4>
                  <p className="mt-2 text-[11px] text-[var(--altus-text-secondary)]">
                    {article.read}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </AltusContainer>
    </section>
  );
}

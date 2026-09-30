"use client";

import { useState } from "react";
import { AltusContainer } from "@/components/altus/AltusContainer";
import { cn } from "@/lib/cn";

const BARS = [
  { label: "Ease of Use", value: 4.8 },
  { label: "Resource Quality", value: 4.9 },
  { label: "Strategy Clarity", value: 4.7 },
  { label: "Advisor Experience", value: 4.8 },
  { label: "Would Recommend", value: 97, suffix: "%" },
];

const FILTERS = [
  "All Businesses",
  "Small Business",
  "Growth Stage",
  "Established",
  "Business Owners",
  "Executives",
];

const REVIEWS = [
  {
    name: "Maya Chen",
    type: "Manufacturing Owner",
    date: "Mar 2026",
    text: "ALTUS helped me organize the questions I should be asking about cash flow and succession — without pushing a product.",
    topics: ["Cash Flow", "Succession"],
  },
  {
    name: "Jordan Blake",
    type: "Professional Services",
    date: "Feb 2026",
    text: "The assessment was short and useful. I finally have a clearer view of where to focus before talking with an advisor.",
    topics: ["Assessment", "Growth"],
  },
  {
    name: "Priya Nair",
    type: "Technology Founder",
    date: "Jan 2026",
    text: "I liked how educational everything felt. Strategy comparisons made complex topics easier to discuss with my team.",
    topics: ["Strategies", "Team"],
  },
  {
    name: "Samuel Ortiz",
    type: "Distribution Business",
    date: "Dec 2025",
    text: "Key employee content was practical. It gave us a shared language for retention conversations.",
    topics: ["Key Employees"],
  },
  {
    name: "Elena Brooks",
    type: "Family Business",
    date: "Nov 2025",
    text: "As a demo review for illustration, this captures how approachable the resource hub feels for busy owners.",
    topics: ["Education", "Planning"],
  },
  {
    name: "Chris Adler",
    type: "Agency Principal",
    date: "Oct 2025",
    text: "Fictional testimonial: the journey steps and readiness profile make progress feel tangible.",
    topics: ["Journey", "Insights"],
  },
];

export function AltusReviews() {
  const [filter, setFilter] = useState("All Businesses");

  return (
    <section className="bg-white py-10 md:py-12">
      <AltusContainer>
        <div className="mb-6 max-w-2xl">
          <h2 className="text-[1.6rem] font-bold tracking-tight text-[var(--altus-text)] md:text-[1.75rem]">
            What Business Owners Are Saying
          </h2>
          <p className="mt-1 text-[14px] text-[var(--altus-text-secondary)]">
            Feedback from business owners using ALTUS to make more informed
            decisions. Demo testimonials for illustration only.
          </p>
        </div>

        <div className="grid gap-4 rounded-[12px] border border-[var(--altus-border)] bg-[var(--altus-section)] p-4 md:grid-cols-[0.85fr_1.15fr] md:p-5">
          <div className="rounded-[10px] bg-[var(--altus-blue)] px-5 py-6 text-white">
            <div className="text-[3rem] font-bold leading-none">4.8</div>
            <div className="mt-1 text-[15px] tracking-wide" aria-label="5 out of 5">
              5.0 rating
            </div>
            <p className="mt-3 text-[13px] text-white/90">Verified member reviews</p>
          </div>
          <div className="space-y-3 self-center px-1 py-2 md:px-3">
            {BARS.map((bar) => {
              const pct =
                bar.suffix === "%" ? bar.value : Math.round((bar.value / 5) * 100);
              return (
                <div key={bar.label} className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3">
                  <span className="text-[12px] text-[var(--altus-text-secondary)]">
                    {bar.label}
                  </span>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[var(--altus-blue)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-right text-[12px] font-semibold text-[var(--altus-text)]">
                    {bar.value}
                    {bar.suffix ?? ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
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

        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {REVIEWS.map((review, index) => (
            <article
              key={review.name}
              className="rounded-[10px] border border-[var(--altus-border-strong)] bg-white p-4 shadow-[var(--altus-shadow)]"
            >
              <div className="flex items-start gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--altus-soft)] text-[12px] font-bold text-[var(--altus-blue)]"
                  aria-hidden
                >
                  {review.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[13px] font-bold text-[var(--altus-text)]">
                      {review.name}
                    </p>
                    <span className="text-[11px] font-semibold text-[var(--altus-success)]">
                      Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--altus-text-secondary)]">
                    {review.type} · {review.date}
                  </p>
                </div>
              </div>
              <p className="mt-1 text-[12px] font-semibold text-[var(--altus-warning)]">
                5 / 5
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--altus-text)]">
                {review.text}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {review.topics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full bg-[var(--altus-section)] px-2 py-0.5 text-[10px] font-medium text-[var(--altus-text-secondary)]"
                  >
                    {topic}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="mt-3 text-[12px] font-semibold text-[var(--altus-blue)] hover:underline"
              >
                Helpful ({12 + index})
              </button>
            </article>
          ))}
        </div>
      </AltusContainer>
    </section>
  );
}

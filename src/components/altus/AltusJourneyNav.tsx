"use client";

import { useState } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Compass,
  Shield,
  TrendingUp,
  Landmark,
  Users,
  MoreHorizontal,
} from "lucide-react";
import { AltusContainer } from "@/components/altus/AltusContainer";
import { cn } from "@/lib/cn";

const STEPS = [
  { key: "learn", label: "Learn", icon: BookOpen },
  { key: "assess", label: "Assess", icon: ClipboardCheck },
  { key: "explore", label: "Explore", icon: Compass },
  { key: "protect", label: "Protect", icon: Shield },
  { key: "grow", label: "Grow", icon: TrendingUp },
  { key: "finance", label: "Finance", icon: Landmark },
  { key: "connect", label: "Connect", icon: Users },
  { key: "more", label: "More", icon: MoreHorizontal },
] as const;

export function AltusJourneyNav() {
  const [active, setActive] = useState<(typeof STEPS)[number]["key"]>("learn");
  const activeIndex = STEPS.findIndex((s) => s.key === active) + 1;

  return (
    <section className="border-b border-[var(--altus-border)] bg-white">
      <AltusContainer className="py-5 md:py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--altus-text-secondary)]">
            YOUR ALTUS JOURNEY
          </p>
          <p className="text-[12px] font-medium text-[var(--altus-text-secondary)]">
            Step {activeIndex} of 8 • {STEPS[activeIndex - 1]?.label}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-8 md:gap-3 md:overflow-visible md:pb-0">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const selected = step.key === active;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => setActive(step.key)}
                className={cn(
                  "flex min-w-[4.75rem] flex-col items-center gap-2 rounded-[10px] border px-2 py-3 transition",
                  selected
                    ? "border-[var(--altus-blue)] bg-[var(--altus-blue)] text-white shadow-[var(--altus-shadow)]"
                    : "border-[var(--altus-border)] bg-white text-[var(--altus-text)] shadow-[var(--altus-shadow)] hover:border-[var(--altus-blue)]/40",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span className="text-[11px] font-semibold">{step.label}</span>
              </button>
            );
          })}
        </div>
      </AltusContainer>
    </section>
  );
}

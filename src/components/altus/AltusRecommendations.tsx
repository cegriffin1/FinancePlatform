import {
  ClipboardList,
  Users,
  ListChecks,
  Calculator,
  Bell,
  GitCompare,
  MessageCircle,
} from "lucide-react";
import { AltusContainer } from "@/components/altus/AltusContainer";

const RECS = [
  {
    title: "Business Growth Readiness Assessment",
    meta: "Business Growth • 2 min",
    icon: ClipboardList,
    tone: "bg-[#E8F5EF] text-[var(--altus-success)]",
  },
  {
    title: "Executive Retention Strategy Guide",
    meta: "Key Employees • 6 min read",
    icon: Users,
    tone: "bg-[#F4EEFF] text-[#7A4FD3]",
  },
  {
    title: "Succession Readiness Checklist",
    meta: "Succession • 4 min",
    icon: ListChecks,
    tone: "bg-[#EDF6FC] text-[var(--altus-blue)]",
  },
  {
    title: "Cash Flow Opportunity Calculator",
    meta: "Finance • 3 min",
    icon: Calculator,
    tone: "bg-[#FFF6E8] text-[var(--altus-warning)]",
  },
];

const PROFILE = [
  { label: "Pages Explored", value: 8 },
  { label: "Guides Viewed", value: 4 },
  { label: "Resources Saved", value: 2 },
  { label: "Assessments", value: 1 },
];

export function AltusRecommendations() {
  return (
    <section id="strategies" className="bg-[var(--altus-soft)] py-10 md:py-12">
      <AltusContainer>
        <div className="grid gap-5 lg:grid-cols-[1.7fr_0.9fr]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[1.15rem] font-bold text-[var(--altus-text)]">
                Recommended for You
              </h2>
              <p className="text-[12px] text-[var(--altus-text-secondary)]">
                Based on your browsing
              </p>
            </div>
            <div className="space-y-3">
              {RECS.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.title}
                    href="#resources"
                    className="flex items-center gap-3 rounded-[10px] border border-[var(--altus-border)] bg-white px-4 py-3.5 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--altus-shadow-hover)]"
                  >
                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span>
                      <span className="block text-[14px] font-semibold text-[var(--altus-text)]">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-[var(--altus-text-secondary)]">
                        {item.meta}
                      </span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>

          <aside className="rounded-[12px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-bold text-[var(--altus-text)]">
                Your Engagement Profile
              </h3>
              <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--altus-blue)]">
                Early Stage
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[11px] font-medium text-[var(--altus-text-secondary)]">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-[linear-gradient(90deg,#9ec9e8,#0068B5,#004E8A)]">
                <span className="absolute top-1/2 left-[28%] h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-[var(--altus-blue)] shadow" />
              </div>
            </div>

            <dl className="mt-5 space-y-2.5">
              {PROFILE.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between text-[13px]"
                >
                  <dt className="text-[var(--altus-text-secondary)]">{row.label}</dt>
                  <dd className="font-semibold text-[var(--altus-text)]">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 rounded-[10px] bg-[var(--altus-section)] p-3.5">
              <p className="text-[12px] font-bold text-[var(--altus-text)]">
                ALTUS Intelligence
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--altus-text-secondary)]">
                Your recommendations become smarter as you explore.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Notify Me",
              body: "Never miss a relevant insight.",
              icon: Bell,
              filled: false,
            },
            {
              title: "Compare Strategies",
              body: "Compare approaches side-by-side.",
              icon: GitCompare,
              filled: false,
            },
            {
              title: "Talk With an Advisor",
              body: "Get answers when you're ready.",
              icon: MessageCircle,
              filled: true,
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <a
                key={card.title}
                href={card.filled ? "#retirement-assessment" : "#resources"}
                className={
                  card.filled
                    ? "rounded-[10px] bg-[var(--altus-blue)] p-5 text-white shadow-[var(--altus-shadow)] transition hover:bg-[var(--altus-blue-deep)]"
                    : "rounded-[10px] border border-[var(--altus-border)] bg-white p-5 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--altus-shadow-hover)]"
                }
              >
                <Icon
                  className={`h-5 w-5 ${card.filled ? "text-white" : "text-[var(--altus-blue)]"}`}
                  strokeWidth={1.75}
                />
                <h3
                  className={`mt-3 text-[15px] font-bold ${card.filled ? "text-white" : "text-[var(--altus-text)]"}`}
                >
                  {card.title}
                </h3>
                <p
                  className={`mt-1 text-[13px] ${card.filled ? "text-white/90" : "text-[var(--altus-text-secondary)]"}`}
                >
                  {card.body}
                </p>
              </a>
            );
          })}
        </div>
      </AltusContainer>
    </section>
  );
}

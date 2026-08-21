import {
  TrendingUp,
  Wallet,
  Receipt,
  Shield,
  UserCheck,
  Waypoints,
} from "lucide-react";
import { AltusContainer } from "@/components/altus/AltusContainer";

const TOPICS = [
  {
    title: "Business Value & Growth",
    description:
      "Understand what drives business value and where your strongest opportunities may exist.",
    resources: 12,
    badge: "Most Viewed",
    icon: TrendingUp,
    tone: "bg-[#E8F5EF] text-[var(--altus-success)]",
  },
  {
    title: "Cash Flow & Capital",
    description:
      "Learn how stronger cash flow can create more flexibility for your business.",
    resources: 9,
    badge: null,
    icon: Wallet,
    tone: "bg-[#EDF6FC] text-[var(--altus-blue)]",
  },
  {
    title: "Tax Strategy",
    description:
      "Explore educational resources around business tax planning and financial efficiency.",
    resources: 15,
    badge: "New Content",
    icon: Receipt,
    tone: "bg-[#FFF6E8] text-[var(--altus-warning)]",
  },
  {
    title: "Protection & Continuity",
    description:
      "Understand risks involving ownership, key employees, and business continuity.",
    resources: 11,
    badge: null,
    icon: Shield,
    tone: "bg-[#EEF1FF] text-[#4F6BED]",
  },
  {
    title: "Key Employee Strategy",
    description:
      "Explore approaches designed to attract, reward, and retain valuable people.",
    resources: 10,
    badge: null,
    icon: UserCheck,
    tone: "bg-[#F4EEFF] text-[#7A4FD3]",
  },
  {
    title: "Succession & Exit",
    description:
      "Learn how business owners prepare for transition, succession, and eventual exit.",
    resources: 8,
    badge: null,
    icon: Waypoints,
    tone: "bg-[#EAF8F4] text-[#0F8A6B]",
  },
];

export function AltusStartHere() {
  return (
    <section id="growth-hub" className="bg-white py-10 md:py-12">
      <AltusContainer>
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[1.6rem] font-bold tracking-tight text-[var(--altus-text)] md:text-[1.75rem]">
              Start Here
            </h2>
            <p className="mt-1 text-[14px] text-[var(--altus-text-secondary)]">
              Six topics every business owner should understand.
            </p>
          </div>
          <a
            href="#resources"
            className="shrink-0 text-[13px] font-semibold text-[var(--altus-blue)] transition hover:underline"
          >
            Browse all →
          </a>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <article
                key={topic.title}
                className="group rounded-[10px] border border-[var(--altus-border-strong)] bg-white p-5 shadow-[var(--altus-shadow)] transition hover:-translate-y-0.5 hover:shadow-[var(--altus-shadow-hover)]"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${topic.tone}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  {topic.badge ? (
                    <span className="rounded-full bg-[var(--altus-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--altus-blue)]">
                      {topic.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-[15px] font-bold text-[var(--altus-text)]">
                  {topic.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--altus-text-secondary)]">
                  {topic.description}
                </p>
                <p className="mt-4 text-[12px] font-semibold text-[var(--altus-blue)]">
                  {topic.resources} resources
                </p>
              </article>
            );
          })}
        </div>
      </AltusContainer>
    </section>
  );
}

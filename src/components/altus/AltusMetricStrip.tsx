import { AltusContainer } from "@/components/altus/AltusContainer";

const METRICS = [
  { value: "2 min", label: "Average Assessment" },
  { value: "100+", label: "Growth Resources" },
  { value: "4.8★", label: "Member Rating" },
  { value: "360°", label: "Business Journey" },
];

export function AltusMetricStrip() {
  return (
    <section className="relative z-0 bg-[var(--altus-blue-deep)]">
      <AltusContainer className="grid grid-cols-2 gap-4 py-5 md:grid-cols-4 md:gap-6 md:py-6 md:pt-10">
        {METRICS.map((metric) => (
          <div key={metric.label} className="text-center text-white">
            <div className="text-[1.35rem] font-bold tracking-tight md:text-[1.5rem]">
              {metric.value}
            </div>
            <div className="mt-0.5 text-[11px] text-white/80 md:text-[12px]">
              {metric.label}
            </div>
          </div>
        ))}
      </AltusContainer>
    </section>
  );
}

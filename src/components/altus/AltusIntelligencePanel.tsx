import { AltusContainer } from "@/components/altus/AltusContainer";

const CHIPS = [
  "Business Growth",
  "Tax Strategy",
  "Key Employees",
  "Succession",
  "Cash Flow",
];

export function AltusIntelligencePanel() {
  return (
    <section id="why-altus" className="bg-white py-6 md:py-8">
      <AltusContainer>
        <div className="overflow-hidden rounded-[14px] bg-[linear-gradient(135deg,var(--altus-blue-deep),var(--altus-blue))] px-6 py-8 text-white shadow-[var(--altus-shadow)] md:px-8 md:py-9">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.14em] text-white/80">
                POWERED BY ALTUS INTELLIGENCE
              </p>
              <h2 className="mt-3 max-w-[18ch] text-[1.55rem] font-bold leading-tight tracking-tight md:text-[1.8rem]">
                Your experience gets smarter as you explore.
              </h2>
              <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-white/90">
                Every interaction helps ALTUS understand what matters to your
                business and surface more relevant educational resources,
                strategies, and next steps.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-white/35 px-3 py-1 text-[11px] font-medium text-white"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[10px] border border-white/20 bg-white/10 p-4 backdrop-blur-[2px]">
                <p className="text-[12px] font-bold tracking-[0.08em]">SMARTER</p>
                <ul className="mt-2 space-y-1.5 text-[13px] text-white/90">
                  <li>Topics viewed</li>
                  <li>Resources saved</li>
                  <li>Assessments completed</li>
                  <li>Engagement signals</li>
                </ul>
              </div>
              <div className="rounded-[10px] border border-white/20 bg-white/10 p-4 backdrop-blur-[2px]">
                <p className="text-[12px] font-bold tracking-[0.08em]">PRIVATE</p>
                <ul className="mt-2 space-y-1.5 text-[13px] text-white/90">
                  <li>Encrypted data</li>
                  <li>Secure access</li>
                  <li>Role-based permissions</li>
                  <li>Private organization workspace</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </AltusContainer>
    </section>
  );
}

import Link from "next/link";
import { AltusMark } from "@/components/brand/AltusLogo";
import { AltusContainer } from "@/components/altus/AltusContainer";

export function AltusFinalCta() {
  return (
    <section id="assessment" className="bg-white py-14 md:py-16">
      <AltusContainer className="text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--altus-border)] bg-[var(--altus-soft)]">
          <AltusMark className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-[1.7rem] font-bold tracking-tight text-[var(--altus-text)] md:text-[1.9rem]">
          Ready to take the next step?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[var(--altus-text-secondary)]">
          Return to the Retirement Assessment above — or continue exploring
          strategies and resources across ALTUS.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="#retirement-assessment"
            className="inline-flex min-w-[10.5rem] items-center justify-center rounded-md bg-[var(--altus-blue)] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[var(--altus-blue-deep)]"
          >
            Start Assessment
          </Link>
          <Link
            href="#resources"
            className="inline-flex min-w-[10.5rem] items-center justify-center rounded-md bg-[var(--altus-section)] px-5 py-2.5 text-[13px] font-semibold text-[var(--altus-text)] transition hover:bg-[var(--altus-soft)]"
          >
            Request Information
          </Link>
          <Link
            href="#growth-hub"
            className="inline-flex min-w-[10.5rem] items-center justify-center rounded-md border border-[var(--altus-border-strong)] bg-white px-5 py-2.5 text-[13px] font-semibold text-[var(--altus-text)] transition hover:border-[var(--altus-blue)]/40"
          >
            Continue Exploring
          </Link>
        </div>
      </AltusContainer>
    </section>
  );
}

import type { Metadata } from "next";
import { HIGHWATER_BRAND } from "@/domain/brand/highwater";

export const metadata: Metadata = {
  title: `${HIGHWATER_BRAND.name} — Coming Soon`,
  description: `${HIGHWATER_BRAND.name} retirement assessment is not publicly available yet.`,
  robots: { index: false, follow: false },
};

/**
 * Controlled public surface while HIGHWATER_PUBLIC_LAUNCH is not `open`.
 * No assessment controls, contact fields, or consent capture.
 */
export default function AssessmentUnavailablePage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b1f33_0%,#12324f_45%,#0b1f33_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70">
          {HIGHWATER_BRAND.name.toUpperCase()}
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          Assessment coming soon
        </h1>
        <p className="mt-4 text-base text-white/85 md:text-lg">
          The Highwater Capital retirement assessment is not publicly available
          yet. No information is being collected on this page.
        </p>
        <p className="mt-6 text-sm text-white/65">
          {HIGHWATER_BRAND.positioning}
        </p>
      </div>
    </main>
  );
}

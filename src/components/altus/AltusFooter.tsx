import Link from "next/link";
import { AltusLogo } from "@/components/brand/AltusLogo";
import { AltusContainer } from "@/components/altus/AltusContainer";

const COLUMNS = [
  {
    title: "RESOURCE HUB",
    links: [
      "Business Growth",
      "Tax Strategy",
      "Key Employees",
      "Succession",
      "Calculators",
    ],
  },
  {
    title: "COMPANY",
    links: ["Why ALTUS", "About", "Partners", "Careers"],
  },
  {
    title: "CONTACT",
    links: [
      "Talk With an Advisor",
      "Request Information",
      "Customer Support",
    ],
  },
];

export function AltusFooter() {
  return (
    <footer id="resources" className="bg-[var(--altus-footer)] text-white">
      <AltusContainer className="grid gap-10 py-12 md:grid-cols-[1.2fr_1.8fr]">
        <div>
          <AltusLogo inverted showDescriptor />
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-white/75">
            Financial intelligence designed to help business owners explore
            opportunities, understand strategies, and make better-informed
            decisions.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-bold tracking-[0.12em] text-white/90">
                {column.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#growth-hub"
                      className="text-[13px] text-white/70 transition hover:text-white"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </AltusContainer>
      <div className="border-t border-white/10">
        <AltusContainer className="flex flex-col gap-3 py-4 text-[12px] text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© ALTUS</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {["Privacy Policy", "Terms of Use", "Accessibility", "Security"].map(
              (item) => (
                <Link key={item} href="/" className="hover:text-white">
                  {item}
                </Link>
              ),
            )}
          </div>
        </AltusContainer>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AltusLogo } from "@/components/brand/AltusLogo";
import { AltusContainer } from "@/components/altus/AltusContainer";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "#growth-hub", label: "Growth Hub" },
  { href: "#strategies", label: "Strategies" },
  { href: "#solutions", label: "Solutions" },
  { href: "#insights", label: "Insights" },
  { href: "#why-altus", label: "Why ALTUS" },
  { href: "#resources", label: "Resources" },
];

export function AltusNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--altus-border)] bg-white">
      <AltusContainer className="flex h-14 items-center justify-between gap-4 md:h-16">
        <Link href="/" aria-label="ALTUS home" className="shrink-0">
          <AltusLogo />
        </Link>

        <nav
          className="hidden items-center gap-5 lg:flex xl:gap-6"
          aria-label="Primary"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-[13px] font-medium text-[var(--altus-text-secondary)] transition hover:text-[var(--altus-blue)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/login"
            className="text-[13px] font-medium text-[var(--altus-text-secondary)] transition hover:text-[var(--altus-blue)]"
          >
            For Advisors
          </Link>
          <Link
            href="#assessment"
            className="rounded-md bg-[var(--altus-blue)] px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-[var(--altus-blue-deep)]"
          >
            Start Assessment
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex rounded-md border border-[var(--altus-border)] p-2 text-[var(--altus-text)] lg:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </AltusContainer>

      <div
        className={cn(
          "border-t border-[var(--altus-border)] bg-white lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <AltusContainer className="flex flex-col gap-1 py-3">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-2 py-2 text-sm font-medium text-[var(--altus-text)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link href="/login" className="px-2 py-2 text-sm text-[var(--altus-text-secondary)]">
            For Advisors
          </Link>
          <Link
            href="#assessment"
            className="mt-1 rounded-md bg-[var(--altus-blue)] px-3 py-2 text-center text-sm font-semibold text-white"
            onClick={() => setOpen(false)}
          >
            Start Assessment
          </Link>
        </AltusContainer>
      </div>
    </header>
  );
}

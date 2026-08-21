"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AltusMark } from "@/components/brand/AltusLogo";
import { cn } from "@/lib/cn";

const PROMPTS = [
  "How can I grow my business value?",
  "What should I know about succession?",
  "How do I retain key employees?",
  "Where should I start?",
];

export function AltusAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open ? (
        <div className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[12px] border border-[var(--altus-border)] bg-white shadow-[var(--altus-shadow-hover)]">
          <div className="flex items-center justify-between bg-[var(--altus-blue)] px-4 py-3 text-white">
            <div>
              <p className="text-[13px] font-bold">Ask ALTUS</p>
              <p className="text-[11px] text-white/85">
                What can I help you explore?
              </p>
            </div>
            <button
              type="button"
              aria-label="Close assistant"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2 p-3">
            {PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="w-full rounded-[8px] border border-[var(--altus-border)] bg-[var(--altus-section)] px-3 py-2.5 text-left text-[12px] font-medium text-[var(--altus-text)] transition hover:border-[var(--altus-blue)]/35 hover:bg-white"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Open ALTUS assistant"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--altus-blue)] text-white shadow-[0_8px_24px_rgba(0,104,181,0.35)] transition hover:bg-[var(--altus-blue-deep)]",
          open && "ring-2 ring-[var(--altus-blue)]/30",
        )}
      >
        <AltusMark inverted className="h-6 w-6" />
      </button>
    </div>
  );
}

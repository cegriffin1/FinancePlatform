"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  detectBrowserTimeZone,
  PREFERRED_TIME_SLOTS,
} from "@/domain/appointments/preferredRequest";

const COMMON_TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;

export function AppointmentPreferenceForm({
  defaultContact,
  submitting,
  error,
  onSubmit,
  onSkip,
}: {
  defaultContact: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: {
    preferredDate: string;
    preferredTime: string;
    timeZone: string;
    preferredContact: string;
  }) => Promise<void>;
  onSkip: () => void;
}) {
  const detectedTz = useMemo(() => detectBrowserTimeZone(), []);
  const [timeZone, setTimeZone] = useState(detectedTz);
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await onSubmit({
      preferredDate: String(form.get("preferredDate") ?? ""),
      preferredTime: String(form.get("preferredTime") ?? ""),
      timeZone: String(form.get("timeZone") ?? timeZone),
      preferredContact: String(form.get("preferredContact") ?? defaultContact),
    });
  }

  const zoneOptions = useMemo(() => {
    const set = new Set<string>([...COMMON_TIME_ZONES, detectedTz, timeZone]);
    return [...set].filter(Boolean).sort();
  }, [detectedTz, timeZone]);

  return (
    <form
      className="rounded-[18px] border border-[var(--altus-border)] bg-white p-6 shadow-[var(--altus-shadow)] md:p-8"
      onSubmit={(e) => void handleSubmit(e)}
    >
      <p className="text-[11px] font-bold tracking-[0.14em] text-[var(--altus-blue)]">
        OPTIONAL NEXT STEP
      </p>
      <h3 className="mt-2 text-xl font-bold text-[var(--altus-text)]">
        Request a conversation
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--altus-text-secondary)]">
        Share a preferred date and time. This is a <strong>request only</strong> —
        not a confirmed appointment, and no advisor is assigned yet.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-semibold">
          Preferred date
          <input
            required
            type="date"
            name="preferredDate"
            min={minDate}
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
          />
        </label>
        <label className="block space-y-1 text-sm font-semibold">
          Preferred time
          <select
            required
            name="preferredTime"
            defaultValue="10:00"
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
          >
            {PREFERRED_TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {formatSlot(slot)}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm font-semibold sm:col-span-2">
          Time zone
          <select
            required
            name="timeZone"
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
          >
            {zoneOptions.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 text-sm font-semibold sm:col-span-2">
          Preferred contact method
          <select
            name="preferredContact"
            defaultValue={defaultContact}
            className="min-h-12 w-full rounded-[10px] border border-[var(--altus-border)] px-3 py-2.5 text-sm font-normal"
          >
            <option>Phone</option>
            <option value="SMS">Text</option>
            <option>Email</option>
          </select>
        </label>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 rounded-md bg-[var(--altus-blue)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit appointment request"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={onSkip}
          className="min-h-12 rounded-md border border-[var(--altus-border)] px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}

function formatSlot(slot: string) {
  const [h, m] = slot.split(":").map(Number);
  const hour = h ?? 0;
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = ((hour + 11) % 12) + 1;
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

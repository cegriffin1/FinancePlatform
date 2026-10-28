/**
 * Preferred appointment request validation.
 * These are consumer preferences — never confirmed bookings.
 */

export const APPOINTMENT_REQUEST_STATUS = "requested" as const;
export const APPOINTMENT_REQUEST_AGENT_PLACEHOLDER = "Pending eligibility review";

export const PREFERRED_TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

export type PreferredTimeSlot = (typeof PREFERRED_TIME_SLOTS)[number];

export type AppointmentPreferenceInput = {
  preferredDate: string;
  preferredTime: string;
  timeZone: string;
};

export type ValidatedAppointmentPreference = {
  preferredDate: string;
  preferredTime: PreferredTimeSlot;
  timeZone: string;
  /** Approximate ISO instant for the preferred local wall time. */
  preferredAtIso: string;
  notes: string;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function detectBrowserTimeZone(fallback = "America/New_York"): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : fallback;
  } catch {
    return fallback;
  }
}

export function validateAppointmentPreference(
  input: AppointmentPreferenceInput,
  now = new Date(),
): { ok: true; value: ValidatedAppointmentPreference } | { ok: false; error: string } {
  const preferredDate = String(input.preferredDate ?? "").trim();
  const preferredTime = String(input.preferredTime ?? "").trim();
  const timeZone = String(input.timeZone ?? "").trim();

  if (!DATE_RE.test(preferredDate)) {
    return { ok: false, error: "Select a valid preferred date." };
  }
  if (!TIME_RE.test(preferredTime)) {
    return { ok: false, error: "Select a valid preferred time." };
  }
  if (!(PREFERRED_TIME_SLOTS as readonly string[]).includes(preferredTime)) {
    return { ok: false, error: "Select a preferred time from the available options." };
  }
  if (!timeZone || timeZone.length < 3 || timeZone.length > 64) {
    return { ok: false, error: "Select a valid time zone." };
  }
  if (!/^[A-Za-z0-9_+\-\/]+$/.test(timeZone)) {
    return { ok: false, error: "Select a valid time zone." };
  }

  // Validate the IANA zone is recognized.
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(now);
  } catch {
    return { ok: false, error: "Select a valid time zone." };
  }

  const preferredAtIso = localDateTimeToIso(preferredDate, preferredTime, timeZone);
  if (!preferredAtIso) {
    return { ok: false, error: "Unable to interpret that date and time zone." };
  }

  const preferredMs = Date.parse(preferredAtIso);
  const minMs = now.getTime() - 60_000;
  if (!Number.isFinite(preferredMs) || preferredMs < minMs) {
    return { ok: false, error: "Preferred date and time must be in the future." };
  }

  const maxMs = now.getTime() + 180 * 24 * 60 * 60 * 1000;
  if (preferredMs > maxMs) {
    return { ok: false, error: "Preferred date must be within the next 180 days." };
  }

  return {
    ok: true,
    value: {
      preferredDate,
      preferredTime: preferredTime as PreferredTimeSlot,
      timeZone,
      preferredAtIso,
      notes: [
        "PREFERRED_REQUEST_NOT_CONFIRMED",
        `preferred_date=${preferredDate}`,
        `preferred_time=${preferredTime}`,
        `time_zone=${timeZone}`,
      ].join("; "),
    },
  };
}

/**
 * Convert local calendar date + HH:mm in an IANA zone to an ISO UTC string.
 * Binary-search UTC so the zoned wall-clock matches the requested local time.
 */
export function localDateTimeToIso(
  date: string,
  time: string,
  timeZone: string,
): string | null {
  try {
    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || hh == null || mm == null) return null;

    const targetKey = wallKey(y, m, d, hh, mm);
    // Seed around the UTC equivalent of that civil time.
    let lo = Date.UTC(y, m - 1, d, hh, mm, 0) - 36 * 3600_000;
    let hi = Date.UTC(y, m - 1, d, hh, mm, 0) + 36 * 3600_000;

    for (let i = 0; i < 40; i++) {
      const mid = Math.floor((lo + hi) / 2);
      const parts = zonedParts(new Date(mid), timeZone);
      if (!parts) return null;
      const key = wallKey(parts.y, parts.m, parts.d, parts.hh, parts.mm);
      if (key === targetKey) {
        return new Date(mid).toISOString();
      }
      if (key < targetKey) lo = mid + 60_000;
      else hi = mid - 60_000;
      if (lo > hi) break;
    }

    // Fallback: scan nearby minute window from UTC civil guess.
    const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
    for (let delta = -16 * 60; delta <= 16 * 60; delta++) {
      const t = guess + delta * 60_000;
      const parts = zonedParts(new Date(t), timeZone);
      if (!parts) continue;
      if (wallKey(parts.y, parts.m, parts.d, parts.hh, parts.mm) === targetKey) {
        return new Date(t).toISOString();
      }
    }
    return null;
  } catch {
    return null;
  }
}

function wallKey(y: number, m: number, d: number, hh: number, mm: number) {
  return y * 1e8 + m * 1e6 + d * 1e4 + hh * 100 + mm;
}

function zonedParts(date: Date, timeZone: string) {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = fmt.formatToParts(date);
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? NaN);
    const y = get("year");
    const m = get("month");
    const d = get("day");
    let hh = get("hour");
    const mm = get("minute");
    if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
    // Some engines emit 24:00 for midnight — normalize.
    if (hh === 24) hh = 0;
    return { y, m, d, hh, mm };
  } catch {
    return null;
  }
}

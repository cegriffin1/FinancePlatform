import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_REQUEST_STATUS,
  validateAppointmentPreference,
} from "./preferredRequest";

describe("preferred appointment request validation", () => {
  const future = new Date("2026-10-16T12:00:00.000Z");

  it("accepts a future preferred date/time with time zone", () => {
    const result = validateAppointmentPreference(
      {
        preferredDate: "2026-10-20",
        preferredTime: "10:00",
        timeZone: "America/New_York",
      },
      future,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preferredTime).toBe("10:00");
    expect(result.value.notes).toContain("PREFERRED_REQUEST_NOT_CONFIRMED");
    expect(result.value.notes).toContain("time_zone=America/New_York");
    expect(APPOINTMENT_REQUEST_STATUS).toBe("requested");
  });

  it("rejects past preferences", () => {
    const result = validateAppointmentPreference(
      {
        preferredDate: "2020-01-01",
        preferredTime: "10:00",
        timeZone: "America/New_York",
      },
      future,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects invalid time slots", () => {
    const result = validateAppointmentPreference(
      {
        preferredDate: "2026-10-20",
        preferredTime: "10:17",
        timeZone: "America/New_York",
      },
      future,
    );
    expect(result.ok).toBe(false);
  });
});

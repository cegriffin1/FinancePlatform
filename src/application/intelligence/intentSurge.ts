export class IntentSurgeService {
  detect(events: Array<{ type: string; occurred_at: string }>): {
    surged: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    const windowMs = 7 * 24 * 3600_000;
    const recent = events.filter(
      (e) => Date.now() - new Date(e.occurred_at).getTime() < windowMs,
    );
    const meaningfulTypes = new Set([
      "assessment_completed",
      "appointment_requested",
      "appointment_cta_viewed",
      "contact_submitted",
    ]);
    const meaningful = recent.filter((e) => meaningfulTypes.has(e.type));

    if (meaningful.length >= 2) {
      reasons.push("Multiple meaningful actions in 7 days");
    }
    if (
      meaningful.some((e) =>
        ["appointment_requested", "appointment_cta_viewed"].includes(e.type),
      )
    ) {
      reasons.push("Appointment-related intent");
    }

    return { surged: meaningful.length >= 2, reasons };
  }
}

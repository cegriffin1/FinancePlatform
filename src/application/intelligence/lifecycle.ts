import {
  DEFAULT_SLA_MINUTES,
  type LeadSlaTimers,
  type NextBestAction,
  type PipelineStage,
} from "@/domain/types/lead-intelligence";

export class LeadSlaService {
  slaMinutesForTemperature(temperature: string): number {
    const key = temperature as keyof typeof DEFAULT_SLA_MINUTES;
    return DEFAULT_SLA_MINUTES[key] ?? DEFAULT_SLA_MINUTES.QUALIFIED;
  }

  buildTimers(input: {
    createdAt: string;
    distributedAt?: string | null;
    assignedAt?: string | null;
    firstViewedAt?: string | null;
    firstAttemptAt?: string | null;
    firstContactAt?: string | null;
    appointmentAt?: string | null;
    temperature: string;
  }): LeadSlaTimers {
    const created = new Date(input.createdAt).getTime();
    const diff = (iso: string | null | undefined) =>
      iso ? new Date(iso).getTime() - created : null;
    const slaMinutes = this.slaMinutesForTemperature(input.temperature);
    const firstAction = input.firstAttemptAt ?? input.firstViewedAt;
    let sla_status: LeadSlaTimers["sla_status"] = "pending";
    if (firstAction) {
      const elapsedMin =
        (new Date(firstAction).getTime() - created) / 60000;
      sla_status = elapsedMin <= slaMinutes ? "ok" : "breached";
    } else {
      const elapsedMin = (Date.now() - created) / 60000;
      if (elapsedMin > slaMinutes) sla_status = "breached";
      else if (elapsedMin > slaMinutes * 0.7) sla_status = "warning";
      else sla_status = "pending";
    }

    return {
      lead_created_at: input.createdAt,
      distributed_at: input.distributedAt ?? null,
      assigned_at: input.assignedAt ?? null,
      first_viewed_at: input.firstViewedAt ?? null,
      first_contact_attempt_at: input.firstAttemptAt ?? null,
      first_contact_at: input.firstContactAt ?? null,
      appointment_at: input.appointmentAt ?? null,
      time_to_distribution_ms: diff(input.distributedAt),
      time_to_assignment_ms: diff(input.assignedAt),
      time_to_first_view_ms: diff(input.firstViewedAt),
      time_to_first_attempt_ms: diff(input.firstAttemptAt),
      time_to_contact_ms: diff(input.firstContactAt),
      sla_minutes: slaMinutes,
      sla_status,
    };
  }
}

export class NurtureEligibilityService {
  shouldNurture(input: {
    temperature: string;
    recommendedAction: NextBestAction;
    qualityGate: string;
    timeline?: string;
  }): boolean {
    if (input.recommendedAction === "NURTURE") return true;
    if (input.temperature === "COLD") return true;
    if (input.qualityGate === "NURTURE") return true;
    if (
      input.timeline === "Within 6 months" ||
      input.timeline === "Exploring options"
    ) {
      return true;
    }
    return false;
  }
}

export function actionLabel(action: NextBestAction): string {
  const map: Record<NextBestAction, string> = {
    CALL_NOW: "Call within 5 minutes",
    SEND_EMAIL: "Send a personalized email",
    SEND_SMS: "Send SMS",
    BOOK_APPOINTMENT: "Book appointment",
    SEND_RESOURCE: "Send educational resource",
    NURTURE: "Add to nurture journey",
    MANAGER_REVIEW: "Manager review required",
    WAIT: "Wait for additional signals",
    NO_ACTION: "No action",
  };
  return map[action];
}

export function nextStageAfterOutcome(outcome: string): PipelineStage {
  switch (outcome) {
    case "Appointment Scheduled":
      return "Appointment";
    case "Appointment Completed":
      return "Qualified";
    case "Qualified Opportunity":
      return "Opportunity";
    case "Proposal":
      return "Proposal";
    case "Won":
      return "Won";
    case "Lost":
      return "Lost";
    case "Nurture":
      return "Nurture";
    case "Unable to Reach":
      return "Attempted";
    default:
      return "Contacted";
  }
}

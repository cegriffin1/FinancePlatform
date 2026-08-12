import type { CommunicationProvider } from "@/domain/interfaces/CommunicationProvider";
import type { CalendarProvider } from "@/domain/interfaces/CalendarProvider";
import type { CRMProvider } from "@/domain/interfaces/CRMProvider";
import type { ContactCenterProvider } from "@/domain/interfaces/ContactCenterProvider";
import type { AnalyticsProvider } from "@/domain/interfaces/AnalyticsProvider";
import type { Appointment } from "@/domain/types";

export class StubCommunicationProvider implements CommunicationProvider {
  async send() {
    return { id: "stub-message" };
  }
}

export class StubCalendarProvider implements CalendarProvider {
  async listAppointments(): Promise<Appointment[]> {
    return [];
  }
  async createAppointment(input: Omit<Appointment, "id" | "created_at" | "updated_at">) {
    const now = new Date().toISOString();
    return {
      ...input,
      id: "00000000-0000-4000-8000-000000000001",
      created_at: now,
      updated_at: now,
    };
  }
}

export class StubCRMProvider implements CRMProvider {
  async syncContact() {
    return { externalId: "stub-contact" };
  }
  async syncLead() {
    return { externalId: "stub-lead" };
  }
  async syncOpportunity() {
    return { externalId: "stub-opportunity" };
  }
}

export class StubContactCenterProvider implements ContactCenterProvider {
  async ingestEvent(): Promise<void> {
    return;
  }
}

export class StubAnalyticsProvider implements AnalyticsProvider {
  async query(input: { metric: string }) {
    return { metric: input.metric, points: [] };
  }
}

import type { Appointment, UUID } from "@/domain/types";

export interface CalendarProvider {
  listAppointments(
    organizationId: UUID,
    range: { from: string; to: string },
  ): Promise<Appointment[]>;
  createAppointment(
    input: Omit<Appointment, "id" | "created_at" | "updated_at">,
  ): Promise<Appointment>;
}

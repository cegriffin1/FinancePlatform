/**
 * Preferred appointment request persistence (not confirmed bookings).
 *
 * Durable uniqueness for open `requested` rows requires pending migration
 * `supabase/pending/20261016090000_preferred_appointment_requests.sql`.
 * Until applied, process-local locking + check-then-insert reduce races but
 * cannot guarantee cross-instance safety on Vercel.
 */

import { randomUUID } from "crypto";
import {
  APPOINTMENT_REQUEST_AGENT_PLACEHOLDER,
  APPOINTMENT_REQUEST_STATUS,
  type ValidatedAppointmentPreference,
} from "@/domain/appointments/preferredRequest";
import type { LeadAppointment } from "@/domain/types/setter-handoff";
import { getSimStore, type SimLead } from "@/application/growth/simulationStore";
import { createSupabaseServiceClient } from "@/infrastructure/supabase/admin";
import { isSupabaseDataMode } from "@/lib/dataMode";
import { logAltusError } from "@/lib/observability";

export type AppointmentRequestResult =
  | { ok: true; appointmentId: string; duplicate: boolean }
  | { ok: false; error: string; code: "DUPLICATE" | "NOT_FOUND" | "PERSISTENCE_ERROR" };

/** Process-local serialized locks per lead id (sim + single-instance). */
const leadLocks = new Map<string, Promise<void>>();

async function withLeadLock<T>(leadId: string, fn: () => Promise<T>): Promise<T> {
  const previous = leadLocks.get(leadId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  leadLocks.set(
    leadId,
    previous.then(() => gate).catch(() => gate),
  );
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
    if (leadLocks.get(leadId) === gate) {
      // no-op: next waiter holds the chain
    }
  }
}

export async function persistPreferredAppointmentRequest(input: {
  lead: SimLead;
  preference: ValidatedAppointmentPreference;
  preferredContactMethod: string;
}): Promise<AppointmentRequestResult> {
  return withLeadLock(input.lead.id, () =>
    persistPreferredAppointmentRequestUnlocked(input),
  );
}

async function persistPreferredAppointmentRequestUnlocked(input: {
  lead: SimLead;
  preference: ValidatedAppointmentPreference;
  preferredContactMethod: string;
}): Promise<AppointmentRequestResult> {
  const orgId =
    input.lead.organization_id ?? input.lead.assigned_organization_id;
  if (!orgId) {
    return { ok: false, error: "Lead is missing organization scope.", code: "PERSISTENCE_ERROR" };
  }

  const existingSim = (input.lead.appointments ?? []).find(
    (a) => a.status === APPOINTMENT_REQUEST_STATUS,
  );
  if (existingSim) {
    return { ok: true, appointmentId: existingSim.id, duplicate: true };
  }

  // Also check sim store global appointments (race across lead object copies)
  const storeHit = getSimStore().appointments.find(
    (a) => a.lead_id === input.lead.id && a.status === APPOINTMENT_REQUEST_STATUS,
  );
  if (storeHit) {
    attachSimAppointment(input.lead, storeHit);
    return { ok: true, appointmentId: storeHit.id, duplicate: true };
  }

  if (isSupabaseDataMode()) {
    try {
      const supabase = createSupabaseServiceClient();
      const { data: existing } = await supabase
        .from("lead_appointments")
        .select("id,status")
        .eq("lead_id", input.lead.id)
        .eq("status", APPOINTMENT_REQUEST_STATUS)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        return { ok: true, appointmentId: existing.id as string, duplicate: true };
      }

      const id = randomUUID();
      const { error } = await supabase.from("lead_appointments").insert({
        id,
        organization_id: orgId,
        lead_id: input.lead.id,
        agent_id: null,
        agent_name: APPOINTMENT_REQUEST_AGENT_PLACEHOLDER,
        scheduled_at: input.preference.preferredAtIso,
        preferred_contact_method: input.preferredContactMethod,
        preferred_time_zone: input.preference.timeZone,
        is_preference_only: true,
        notes: input.preference.notes,
        status: APPOINTMENT_REQUEST_STATUS,
        created_by: null,
      });
      if (error) {
        // Unique violation once pending migration is applied
        if (error.code === "23505") {
          const { data: again } = await supabase
            .from("lead_appointments")
            .select("id")
            .eq("lead_id", input.lead.id)
            .eq("status", APPOINTMENT_REQUEST_STATUS)
            .limit(1)
            .maybeSingle();
          return {
            ok: true,
            appointmentId: (again?.id as string) ?? id,
            duplicate: true,
          };
        }
        logAltusError("DATABASE_ERROR", "Preferred appointment insert failed", {
          reason: error.message,
        });
        return {
          ok: false,
          error: "Unable to save appointment request.",
          code: "PERSISTENCE_ERROR",
        };
      }

      try {
        await supabase.from("audit_logs").insert({
          organization_id: orgId,
          action: "appointment_preference_requested",
          entity_type: "lead",
          entity_id: input.lead.id,
          metadata: {
            appointment_id: id,
            status: APPOINTMENT_REQUEST_STATUS,
            time_zone: input.preference.timeZone,
            confirmed: false,
          },
        });
      } catch {
        /* non-fatal */
      }

      attachSimAppointment(input.lead, {
        id,
        lead_id: input.lead.id,
        organization_id: orgId,
        agent_id: "00000000-0000-4000-8000-000000000000",
        agent_name: APPOINTMENT_REQUEST_AGENT_PLACEHOLDER,
        scheduled_at: input.preference.preferredAtIso,
        preferred_contact_method: input.preferredContactMethod,
        notes: input.preference.notes,
        status: APPOINTMENT_REQUEST_STATUS,
        created_by: null,
        created_at: new Date().toISOString(),
      });

      return { ok: true, appointmentId: id, duplicate: false };
    } catch (e) {
      logAltusError("DATABASE_ERROR", "Preferred appointment persistence error", {
        reason: e instanceof Error ? e.message : "unknown",
      });
      return {
        ok: false,
        error: "Unable to save appointment request.",
        code: "PERSISTENCE_ERROR",
      };
    }
  }

  const appointment: LeadAppointment = {
    id: randomUUID(),
    lead_id: input.lead.id,
    organization_id: orgId,
    agent_id: "00000000-0000-4000-8000-000000000000",
    agent_name: APPOINTMENT_REQUEST_AGENT_PLACEHOLDER,
    scheduled_at: input.preference.preferredAtIso,
    preferred_contact_method: input.preferredContactMethod,
    notes: input.preference.notes,
    status: APPOINTMENT_REQUEST_STATUS,
    created_by: null,
    created_at: new Date().toISOString(),
  };
  const store = getSimStore();
  store.appointments.push(appointment);
  attachSimAppointment(input.lead, appointment);
  return { ok: true, appointmentId: appointment.id, duplicate: false };
}

function attachSimAppointment(lead: SimLead, appointment: LeadAppointment) {
  lead.appointments = [...(lead.appointments ?? []).filter((a) => a.id !== appointment.id), appointment];
  const store = getSimStore();
  const idx = store.leads.findIndex((l) => l.id === lead.id);
  if (idx >= 0) store.leads[idx] = lead;
}

/** Test helper — clear process locks between cases. */
export function resetAppointmentRequestLocksForTests() {
  leadLocks.clear();
}

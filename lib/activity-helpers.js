import { getEffectiveWorkspaceRole } from '@/lib/workspace-client'
import { logEvent } from '@/lib/activity-engine'
import { getModuleForEvent } from '@/lib/activity-event-registry'

export function actorFromProfile(profile) {
  if (!profile) {
    return { id: null, name: 'System', role: 'system' }
  }
  return {
    id: profile.id || null,
    name: profile.full_name || profile.email || 'Unknown',
    role: getEffectiveWorkspaceRole(profile),
  }
}

/**
 * Convenience wrapper for API routes — best-effort, never throws.
 */
export async function logActivity(db, profile, event, opts = {}) {
  if (!profile?.clinic_id) return null
  return logEvent(db, {
    clinicId: profile.clinic_id,
    event,
    module: opts.module || getModuleForEvent(event),
    actor: actorFromProfile(profile),
    patientId: opts.patientId ?? opts.patient_id ?? null,
    visitId: opts.visitId ?? opts.visit_id ?? null,
    appointmentId: opts.appointmentId ?? opts.appointment_id ?? null,
    invoiceId: opts.invoiceId ?? opts.invoice_id ?? null,
    labCaseId: opts.labCaseId ?? opts.lab_case_id ?? null,
    metadata: opts.metadata ?? opts.meta ?? {},
  })
}

export function actorFromSystem(name = 'System') {
  return { id: null, name, role: 'system' }
}

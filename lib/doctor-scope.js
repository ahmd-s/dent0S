// Doctor-level data scoping within a clinic (relationship-based via appointments + visits)

import { hasRole, getProfileRoles } from '@/lib/profile-roles'

/**
 * Apply doctor-only scoping when user has doctor role but NOT admin.
 * Admin union bypasses scoping even when also a doctor.
 */
export function shouldScopeToDoctor(roles) {
  const list = getProfileRoles(roles)
  return hasRole(list, 'doctor') && !hasRole(list, 'admin')
}

/**
 * Distinct patient IDs linked to a doctor via appointments or visits.
 */
export async function doctorPatientIds(db, clinicId, doctorId) {
  const [appts, visits] = await Promise.all([
    db.collection('appointments')
      .find({ clinic_id: clinicId, doctor_id: doctorId }, { projection: { patient_id: 1 } })
      .toArray(),
    db.collection('visits')
      .find({ clinic_id: clinicId, doctor_id: doctorId }, { projection: { patient_id: 1 } })
      .toArray(),
  ])
  const ids = new Set()
  for (const a of appts) {
    if (a.patient_id) ids.add(a.patient_id)
  }
  for (const v of visits) {
    if (v.patient_id) ids.add(v.patient_id)
  }
  return [...ids]
}

/** Extra filter fields for appointments list queries. */
export function doctorAppointmentFilter(roles, profileId) {
  if (!shouldScopeToDoctor(roles)) return {}
  return { doctor_id: profileId }
}

/** Extra filter fields for visits list queries. */
export function doctorVisitFilter(roles, profileId) {
  if (!shouldScopeToDoctor(roles)) return {}
  return { doctor_id: profileId }
}

export async function assertDoctorOwnsPatient(db, clinicId, roles, profileId, patientId) {
  if (!shouldScopeToDoctor(roles)) return true
  const ids = await doctorPatientIds(db, clinicId, profileId)
  return ids.includes(patientId)
}

export async function assertDoctorOwnsVisit(db, clinicId, roles, profileId, visit) {
  if (!shouldScopeToDoctor(roles)) return true
  if (!visit) return false
  if (visit.doctor_id === profileId) return true
  if (visit.patient_id) {
    return assertDoctorOwnsPatient(db, clinicId, roles, profileId, visit.patient_id)
  }
  return false
}

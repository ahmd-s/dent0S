import { v4 as uuidv4 } from 'uuid'
import { WHATSAPP_POLICY_VERSION, UNSENT_MESSAGE_STATUSES } from './constants.js'

export async function getPatientPreferences(db, clinicId, patientId) {
  return db.collection('communication_preferences').findOne({
    clinic_id: clinicId,
    patient_id: patientId,
  })
}

export async function getClinicianPreferences(db, clinicId, profileId) {
  return db.collection('communication_preferences').findOne({
    clinic_id: clinicId,
    profile_id: profileId,
  })
}

export function isWhatsAppOptedIn(prefs) {
  if (!prefs) return false
  if (prefs.whatsapp_opt_out_at) return false
  return Boolean(prefs.whatsapp_opt_in && prefs.whatsapp_opt_in_at)
}

export function isClinicianScheduleOptedIn(prefs, profile) {
  if (prefs?.whatsapp_schedule_opt_in && isWhatsAppOptedIn(prefs)) return true
  if (profile?.whatsapp_schedule_opt_in && profile?.whatsapp_number) return true
  return false
}

export async function assertWhatsAppOptIn(db, clinicId, patientId) {
  if (!patientId) {
    return { ok: false, error: 'patient_id required for patient messages', reason: 'consent_required' }
  }
  const prefs = await getPatientPreferences(db, clinicId, patientId)
  if (!isWhatsAppOptedIn(prefs)) {
    return { ok: false, error: 'Patient has not opted in to WhatsApp communication', reason: 'consent_required' }
  }
  return { ok: true, preferences: prefs }
}

export async function setWhatsAppOptIn(db, clinicId, patientId, { source, optedInByUserId, policyVersion }) {
  const now = new Date()
  const existing = await getPatientPreferences(db, clinicId, patientId)

  const update = {
    clinic_id: clinicId,
    patient_id: patientId,
    profile_id: null,
    whatsapp_opt_in: true,
    whatsapp_opt_in_at: now,
    whatsapp_opt_in_source: source || 'staff',
    whatsapp_opt_in_by: optedInByUserId || null,
    whatsapp_opt_in_policy_version: policyVersion || WHATSAPP_POLICY_VERSION,
    whatsapp_opt_out_at: null,
    whatsapp_opt_out_source: null,
    whatsapp_opt_out_by: null,
    whatsapp_opt_out_policy_version: null,
    updated_at: now,
  }

  if (existing) {
    await db.collection('communication_preferences').updateOne(
      { clinic_id: clinicId, patient_id: patientId },
      { $set: update }
    )
    return { ...existing, ...update }
  }

  const doc = { id: uuidv4(), ...update, created_at: now }
  await db.collection('communication_preferences').insertOne(doc)
  return doc
}

export async function setWhatsAppOptOut(db, clinicId, patientId, { source, optedOutByUserId, policyVersion }) {
  const now = new Date()
  const existing = await getPatientPreferences(db, clinicId, patientId)

  const update = {
    clinic_id: clinicId,
    patient_id: patientId,
    whatsapp_opt_in: false,
    whatsapp_opt_out_at: now,
    whatsapp_opt_out_source: source || 'staff',
    whatsapp_opt_out_by: optedOutByUserId || null,
    whatsapp_opt_out_policy_version: policyVersion || WHATSAPP_POLICY_VERSION,
    updated_at: now,
  }

  if (existing) {
    await db.collection('communication_preferences').updateOne(
      { clinic_id: clinicId, patient_id: patientId },
      { $set: update }
    )
    return { ...existing, ...update }
  }

  const doc = {
    id: uuidv4(),
    clinic_id: clinicId,
    patient_id: patientId,
    profile_id: null,
    ...update,
    created_at: now,
  }
  await db.collection('communication_preferences').insertOne(doc)
  return doc
}

export async function setClinicianScheduleOptIn(db, clinicId, profileId, {
  source,
  optedInByUserId,
  contactE164,
  policyVersion,
}) {
  const now = new Date()
  const existing = await getClinicianPreferences(db, clinicId, profileId)

  const update = {
    clinic_id: clinicId,
    profile_id: profileId,
    patient_id: null,
    whatsapp_opt_in: true,
    whatsapp_schedule_opt_in: true,
    whatsapp_contact_e164: contactE164 || null,
    whatsapp_opt_in_at: now,
    whatsapp_opt_in_source: source || 'staff',
    whatsapp_opt_in_by: optedInByUserId || null,
    whatsapp_opt_in_policy_version: policyVersion || WHATSAPP_POLICY_VERSION,
    updated_at: now,
  }

  if (existing) {
    await db.collection('communication_preferences').updateOne(
      { clinic_id: clinicId, profile_id: profileId },
      { $set: update }
    )
    return { ...existing, ...update }
  }

  const doc = { id: uuidv4(), ...update, created_at: now }
  await db.collection('communication_preferences').insertOne(doc)
  return doc
}

export async function cancelUnsentPatientMessages(db, clinicId, patientId) {
  const result = await db.collection('messages').updateMany(
    {
      clinic_id: clinicId,
      patient_id: patientId,
      status: { $in: UNSENT_MESSAGE_STATUSES },
    },
    {
      $set: {
        status: 'cancelled',
        failure_reason: 'consent_revoked',
        updated_at: new Date(),
      },
    }
  )
  return { cancelled: result.modifiedCount || 0 }
}

import { MESSAGE_TYPES } from './constants.js'
import { createMessage, systemProfile } from './messages.js'
import { ensureDefaultProviderConfig } from './registry.js'
import { normalizeToE164, isValidE164 } from './phone.js'
import { buildVisitSummaryVars } from './templates.js'
import { getClinicDateIso, getClinicLocalHourMinute, reminderScheduledAt } from './timezone.js'
import { getClinicianPreferences, isClinicianScheduleOptedIn } from './consent.js'
import { ensureVisitShareToken, buildVisitSummaryPublicUrl } from './secure-links.js'

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

async function getClinicName(db, clinicId) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  return clinic?.name || 'the clinic'
}

async function getPatient(db, clinicId, patientId) {
  if (!patientId) return null
  return db.collection('patients').findOne({ id: patientId, clinic_id: clinicId, is_archived: { $ne: true } })
}

export async function onAppointmentCreated(db, profile, appointment) {
  if (!appointment?.patient_id) return { ok: false, skipped: true }

  if (appointment.status === 'confirmed') {
    return onAppointmentConfirmed(db, profile, appointment)
  }

  await scheduleAppointmentReminders(db, profile, appointment)
  return { ok: true }
}

export async function onAppointmentConfirmed(db, profile, appointment) {
  if (!appointment?.patient_id) return { ok: false, skipped: true }

  const clinicName = await getClinicName(db, profile.clinic_id)
  const patient = await getPatient(db, profile.clinic_id, appointment.patient_id)

  await createMessage(db, profile, {
    type: MESSAGE_TYPES.APPOINTMENT_CONFIRMATION,
    patient_id: appointment.patient_id,
    appointment_id: appointment.id,
    idempotency_key: `appt_confirm:${appointment.id}`,
    template_vars: {
      patient_name: patient?.name || appointment.patient_name_temp || 'Patient',
      clinic_name: clinicName,
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
    },
  })

  await scheduleAppointmentReminders(db, profile, appointment)
  return { ok: true }
}

export async function scheduleAppointmentReminders(db, profile, appointment) {
  if (!appointment?.patient_id) return { ok: false, skipped: true }
  if (['cancelled', 'no_show', 'completed'].includes(appointment.status)) {
    return { ok: false, skipped: true }
  }

  const config = await ensureDefaultProviderConfig(db, profile.clinic_id)
  const offsets = config.settings?.reminder_offsets || [
    { key: '1d', offset_hours: 24 },
    { key: '2h', offset_hours: 2 },
  ]

  const clinicName = await getClinicName(db, profile.clinic_id)
  const patient = await getPatient(db, profile.clinic_id, appointment.patient_id)
  const results = []

  for (const offset of offsets) {
    const scheduledAt = reminderScheduledAt(
      appointment.appointment_date,
      appointment.appointment_time,
      offset.offset_hours
    )
    if (scheduledAt <= new Date()) continue

    const result = await createMessage(db, profile, {
      type: MESSAGE_TYPES.APPOINTMENT_REMINDER,
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      idempotency_key: `appt_reminder:${appointment.id}:${offset.key}:${appointment.appointment_date}`,
      scheduled_at: scheduledAt.toISOString(),
      template_vars: {
        patient_name: patient?.name || appointment.patient_name_temp || 'Patient',
        clinic_name: clinicName,
        appointment_date: appointment.appointment_date,
        appointment_time: appointment.appointment_time,
        reminder_type: offset.key,
      },
    })
    results.push(result)
  }

  return { ok: true, reminders: results }
}

export async function onFollowupAssigned(db, profile, { patientId, followUpDate }) {
  if (!patientId || !followUpDate) return { ok: false, skipped: true }

  const clinicName = await getClinicName(db, profile.clinic_id)
  const patient = await getPatient(db, profile.clinic_id, patientId)

  const reminderDate = new Date(`${followUpDate}T09:00:00`)
  reminderDate.setDate(reminderDate.getDate() - 1)
  const scheduledAt = reminderDate > new Date() ? reminderDate : null

  return createMessage(db, profile, {
    type: MESSAGE_TYPES.FOLLOW_UP_REMINDER,
    patient_id: patientId,
    idempotency_key: `follow_up:${patientId}:${followUpDate}`,
    scheduled_at: scheduledAt?.toISOString() || null,
    template_vars: {
      patient_name: patient?.name || 'Patient',
      clinic_name: clinicName,
      follow_up_date: followUpDate,
    },
  })
}

export async function onVisitCompleted(db, profile, { visit, invoice: _invoice }) {
  if (!visit?.patient_id) return { ok: false, skipped: true }

  // Three independent lookups; they used to run one after another.
  const [clinicName, patient, tokenInfo] = await Promise.all([
    getClinicName(db, profile.clinic_id),
    getPatient(db, profile.clinic_id, visit.patient_id),
    ensureVisitShareToken(db, profile.clinic_id, visit.id),
  ])

  if (!tokenInfo?.token) return { ok: false, error: 'Unable to create secure visit link' }

  const secureLink = buildVisitSummaryPublicUrl(tokenInfo.token, baseUrl())
  const templateVars = buildVisitSummaryVars({
    patientName: patient?.name || 'Patient',
    clinicName,
    secureLink,
  })

  return createMessage(db, profile, {
    type: MESSAGE_TYPES.VISIT_SUMMARY,
    patient_id: visit.patient_id,
    visit_id: visit.id,
    idempotency_key: `visit_summary:${visit.id}`,
    template_vars: templateVars,
  })
}

export async function scheduleDoctorDailySchedules(db, clinicId, targetDate = null) {
  const config = await ensureDefaultProviderConfig(db, clinicId)
  const timezone = config.settings?.timezone || 'Asia/Kolkata'
  const scheduleDate = targetDate || getClinicDateIso(timezone)

  const doctors = await db.collection('profiles').find({
    clinic_id: clinicId,
    is_active: { $ne: false },
    role: { $in: ['doctor', 'admin'] },
  }).toArray()

  const appointments = await db.collection('appointments').find({
    clinic_id: clinicId,
    appointment_date: scheduleDate,
    status: { $nin: ['cancelled', 'no_show'] },
  }).sort({ appointment_time: 1 }).toArray()

  const clinicName = await getClinicName(db, clinicId)
  const profile = systemProfile(clinicId)
  const results = []

  for (const doctor of doctors) {
    const doctorAppts = appointments.filter(a => a.doctor_id === doctor.id)
    if (!doctorAppts.length) continue

    const clinicianPrefs = await getClinicianPreferences(db, clinicId, doctor.id)
    if (!isClinicianScheduleOptedIn(clinicianPrefs, doctor)) continue

    const confirmedContact = clinicianPrefs?.whatsapp_contact_e164
      || (doctor.whatsapp_number ? normalizeToE164(doctor.whatsapp_number) : null)
      || (doctor.phone ? normalizeToE164(doctor.phone) : null)
    if (!confirmedContact || !isValidE164(confirmedContact)) continue

    const scheduleLines = doctorAppts.map(a => {
      const time = a.appointment_time || ''
      return `- ${time} (${a.appointment_type || 'consultation'})`
    }).join('\n')

    const result = await createMessage(db, profile, {
      type: MESSAGE_TYPES.DOCTOR_DAILY_SCHEDULE,
      doctor_id: doctor.id,
      recipient_e164: confirmedContact,
      skip_consent: true,
      idempotency_key: `doctor_schedule:${doctor.id}:${scheduleDate}`,
      template_vars: {
        doctor_name: doctor.full_name || doctor.name || 'Doctor',
        clinic_name: clinicName,
        schedule_date: scheduleDate,
        schedule_lines: scheduleLines,
      },
    })
    results.push(result)
  }

  return { ok: true, scheduled: results.length, results }
}

export async function runDoctorDailyScheduleIfDue(db, clinicId) {
  const config = await ensureDefaultProviderConfig(db, clinicId)
  const timezone = config.settings?.timezone || 'Asia/Kolkata'
  const targetHour = config.settings?.doctor_schedule_hour ?? 7
  const targetMinute = config.settings?.doctor_schedule_minute ?? 0

  const { hour, minute } = getClinicLocalHourMinute(timezone)
  if (hour !== targetHour || minute !== targetMinute) {
    return { ok: true, skipped: true, reason: 'not_due' }
  }

  const scheduleDate = getClinicDateIso(timezone)
  const existing = await db.collection('messages').findOne({
    clinic_id: clinicId,
    type: MESSAGE_TYPES.DOCTOR_DAILY_SCHEDULE,
    idempotency_key: { $regex: `^doctor_schedule:.*:${scheduleDate}$` },
  })
  if (existing) {
    return { ok: true, skipped: true, reason: 'already_scheduled' }
  }

  return scheduleDoctorDailySchedules(db, clinicId, scheduleDate)
}

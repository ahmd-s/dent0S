import { processDueMessages } from './messages.js'
import { runDoctorDailyScheduleIfDue } from './workflows.js'
import { ensureDefaultProviderConfig } from './registry.js'
import { mapPool } from '../async-pool.js'

const CLINIC_SCHEDULE_CONCURRENCY = 5

export async function processCommunicationScheduler(db, clinicId = null) {
  const messagesResult = await processDueMessages(db, clinicId)

  let doctorSchedules = { skipped: true }
  if (clinicId) {
    doctorSchedules = await runDoctorDailyScheduleIfDue(db, clinicId)
  } else {
    const clinics = await db.collection('clinics')
      .find({ subscription_status: { $ne: 'blocked' } })
      .project({ id: 1 })
      .toArray()
    const scheduleResults = await mapPool(clinics, CLINIC_SCHEDULE_CONCURRENCY, async (clinic) => {
      await ensureDefaultProviderConfig(db, clinic.id)
      return runDoctorDailyScheduleIfDue(db, clinic.id)
    })
    doctorSchedules = { clinics: scheduleResults.length, results: scheduleResults }
  }

  return {
    ok: true,
    messages: messagesResult,
    doctor_schedules: doctorSchedules,
  }
}

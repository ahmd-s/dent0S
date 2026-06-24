import { v4 as uuidv4 } from 'uuid'

/**
 * Check if a time slot conflicts with any blocked slots
 * @param {Object} db - MongoDB database instance
 * @param {String} clinic_id - Clinic ID
 * @param {String} doctor_id - Doctor ID (optional for clinic-wide blocks)
 * @param {Date} appointment_start - Start datetime of appointment
 * @param {Date} appointment_end - End datetime of appointment
 * @returns {Promise<Boolean>} - True if conflict exists
 */
export async function checkBlockedSlotConflict(db, clinic_id, doctor_id, appointment_start, appointment_end) {
  const conflict = await db.collection('blocked_slots').findOne({
    clinic_id,
    doctor_id: doctor_id || null,
    is_active: true,
    $or: [
      // Blocked slot starts during appointment
      {
        start_datetime: { $gte: appointment_start, $lt: appointment_end }
      },
      // Blocked slot ends during appointment
      {
        end_datetime: { $gt: appointment_start, $lte: appointment_end }
      },
      // Blocked slot completely covers appointment
      {
        start_datetime: { $lte: appointment_start },
        end_datetime: { $gte: appointment_end }
      }
    ]
  })
  return conflict !== null
}

/**
 * Convert date string and time string to ISO datetime
 * @param {String} date - Date string in YYYY-MM-DD format
 * @param {String} time - Time string in HH:MM format (24-hour)
 * @returns {Date} - ISO datetime
 */
export function toDateTime(date, time) {
  const [hours, minutes] = time.split(':').map(Number)
  const datetime = new Date(date)
  datetime.setHours(hours, minutes, 0, 0)
  return datetime
}

/**
 * Convert ISO datetime to date string (YYYY-MM-DD)
 * @param {Date} datetime - ISO datetime
 * @returns {String} - Date string
 */
export function toDateOnly(datetime) {
  return datetime.toISOString().split('T')[0]
}

/**
 * Convert ISO datetime to time string (HH:MM)
 * @param {Date} datetime - ISO datetime
 * @returns {String} - Time string
 */
export function toTimeOnly(datetime) {
  return datetime.toTimeString().slice(0, 5)
}

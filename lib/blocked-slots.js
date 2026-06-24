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
  // Combine date and time as IST, convert to UTC
  // IST = UTC + 5:30, so UTC = IST - 5:30
  const istString = `${date}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00+05:30`
  return new Date(istString)
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

/**
 * Appointment time parsing utilities.
 * Supports "10:00 AM", "10:30 AM", "2:00 PM" and "14:00" formats.
 */

export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null
  const s = String(timeStr).trim()

  const ampm = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = parseInt(ampm[2], 10)
    const p = ampm[3].toUpperCase()
    if (p === 'PM' && h !== 12) h += 12
    if (p === 'AM' && h === 12) h = 0
    return h * 60 + m
  }

  const h24 = s.match(/^(\d{1,2}):(\d{2})$/)
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10)

  return null
}

export function minutesToTimeLabel(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return ''
  let h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const p = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${String(m).padStart(2, '0')} ${p}`
}

/** Parse appointment date + time string into a Date object. */
export function parseAppointmentTime(isoDate, timeStr) {
  const mins = parseTimeToMinutes(timeStr)
  if (!isoDate || mins == null) return null
  const d = new Date(isoDate + 'T00:00:00')
  d.setMinutes(mins)
  return d
}

export function formatDuration(minutes) {
  if (!minutes) return '30 min'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function startOfWeek(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function weekDates(isoDate) {
  const start = startOfWeek(isoDate)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function monthGrid(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1
  const days = []
  for (let i = startPad; i > 0; i--) {
    const pd = new Date(year, month, 1 - i)
    days.push({ date: pd.toISOString().slice(0, 10), outside: true })
  }
  for (let day = 1; day <= last.getDate(); day++) {
    const cd = new Date(year, month, day)
    days.push({ date: cd.toISOString().slice(0, 10), outside: false })
  }
  while (days.length % 7 !== 0) {
    const next = new Date(year, month + 1, days.length - last.getDate() - startPad + 1)
    days.push({ date: next.toISOString().slice(0, 10), outside: true })
  }
  return days
}

export function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA
}

/** Default clinic hours if not configured. */
export const DEFAULT_CLINIC_HOURS = { open: 9 * 60, close: 18 * 60 }

export function timeSlots(openMin = 9 * 60, closeMin = 18 * 60, step = 15) {
  const slots = []
  for (let t = openMin; t < closeMin; t += step) slots.push(t)
  return slots
}

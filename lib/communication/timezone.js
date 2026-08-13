export function getClinicDateIso(timezone, at = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

export function getClinicLocalHourMinute(timezone, at = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(at)

  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10)
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10)
  return { hour, minute }
}

export function reminderScheduledAt(appointmentDate, appointmentTime, offsetHours) {
  const time = appointmentTime || '09:00'
  const base = new Date(`${appointmentDate}T${time}:00`)
  base.setHours(base.getHours() - offsetHours)
  return base
}

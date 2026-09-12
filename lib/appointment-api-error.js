/** Clinician-facing errors for appointment create/update API responses. */

export function appointmentApiErrorMessage(status, body) {
  if (typeof body === 'string' && body.trim()) return body.trim()
  const msg = (typeof body?.error === 'string' && body.error.trim())
    || (typeof body?.message === 'string' && body.message.trim())
    || ''
  if (msg) return msg
  if (status === 409) return 'This slot is already booked. Choose another time.'
  if (status === 401) return 'You are not signed in. Refresh and sign in, then try again.'
  if (status === 403) return 'You do not have permission to book appointments.'
  if (status === 404) return 'That patient was not found. Select the patient again.'
  if (status === 429) return 'Too many bookings at once. Wait a moment and try again.'
  if (status >= 500) return 'Server error while booking. Try again in a minute.'
  if (!status) return 'Could not book the appointment. Check your connection and try again.'
  return 'Could not book the appointment. Try again.'
}

export async function readAppointmentApiError(response) {
  const body = await response.json().catch(() => ({}))
  return { body, message: appointmentApiErrorMessage(response.status, body) }
}

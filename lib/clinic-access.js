export const CLINIC_ACCESS_PAUSED_MESSAGE =
  "This clinic's access is currently paused. Contact Connec8 for assistance."

export function isClinicAccessBlocked(clinic) {
  return clinic?.subscription_status === 'blocked'
}

export function clinicAccessPausedResponse(err) {
  return err(CLINIC_ACCESS_PAUSED_MESSAGE, 403)
}

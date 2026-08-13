import { guardApiSync } from '../authorization-helpers.js'

/** Explicit communication permission mapping — routes must use these helpers. */
export const COMMUNICATION_PERMISSIONS = {
  viewQueue: { resource: 'appointments', action: 'read' },
  viewMessageBody: { resource: 'appointments', action: 'read' },
  openWhatsApp: { resource: 'appointments', action: 'update' },
  markSent: { resource: 'appointments', action: 'update' },
  cancelMessage: { resource: 'appointments', action: 'update' },
  createMessage: { resource: 'appointments', action: 'create' },
  editPatientConsent: { resource: 'patients', action: 'update' },
  viewPatientConsent: { resource: 'patients', action: 'read' },
  editConfig: { resource: 'settings', action: 'update' },
}

export function guardCommunication(ctx, permissionKey, errFn) {
  const perm = COMMUNICATION_PERMISSIONS[permissionKey]
  if (!perm) return errFn('Invalid permission', 500)
  return guardApiSync(ctx, perm, errFn)
}

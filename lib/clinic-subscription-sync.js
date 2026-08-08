/**
 * Backwards-compatibility shim.
 * All callers have been migrated to lib/subscription-engine.js.
 * This wrapper is retained so any future external caller still works.
 */
import { activateSubscription } from '@/lib/subscription-engine'

/** Unblock clinic access and activate subscription after a successful payment. */
export async function activateClinicAccessOnPayment(db, clinicId) {
  await activateSubscription(db, clinicId)
}

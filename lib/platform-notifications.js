import { v4 as uuidv4 } from 'uuid'

export const PLATFORM_NOTIFICATION_TYPES = [
  'trial_expires_in_3_days',
  'grace_started',
  'grace_expires_tomorrow',
  'clinic_blocked',
  'payment_recovered',
  // Sprint 4
  'payment_failed',
  'webhook_failed',
  'cron_failed',
  'emergency_lock',
  'storage_warning',
  'broadcast_sent',
  'maintenance_enabled',
]

/**
 * Store a platform-admin notification. Delivery (email/push) is out of scope for Sprint 3.
 */
export async function createPlatformNotification(db, { type, clinicId, clinicName, meta = {} }) {
  if (!PLATFORM_NOTIFICATION_TYPES.includes(type)) return
  try {
    await db.collection('platform_notifications').insertOne({
      id: uuidv4(),
      type,
      clinic_id: clinicId,
      clinic_name: clinicName || '',
      meta: meta || {},
      read: false,
      created_at: new Date(),
    })
  } catch (e) {
    console.error('Platform notification error:', e)
  }
}

/**
 * Skip duplicate notifications of the same type for a clinic within a window.
 */
export async function createPlatformNotificationOnce(db, {
  type,
  clinicId,
  clinicName,
  meta = {},
  withinHours = 24,
}) {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000)
  const existing = await db.collection('platform_notifications').findOne({
    type,
    clinic_id: clinicId,
    created_at: { $gte: since },
  })
  if (existing) return
  await createPlatformNotification(db, { type, clinicId, clinicName, meta })
}

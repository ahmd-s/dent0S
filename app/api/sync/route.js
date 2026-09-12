import { requireUser, json, err } from '@/lib/api-helpers'
import { getClinicSync } from '@/lib/clinic-sync'

export const dynamic = 'force-dynamic'

/**
 * Tiny clinic version clock. Clients poll this instead of re-downloading
 * dashboards/lists. Payload is a few bytes; the query is a unique-index point read.
 */
export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    const sync = await getClinicSync(ctx.db, ctx.profile.clinic_id)
    return json(sync)
  } catch (e) {
    console.error('Clinic sync GET error:', e)
    return err('Could not read clinic sync status', 500)
  }
}

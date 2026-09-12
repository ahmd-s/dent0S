import { signToken, setAuthCookie } from '@/lib/auth'
import { ensureProfileRolesMigrated } from '@/lib/profile-roles'
import { canClinicStaffLogin } from '@/lib/platform-admin-console-core'

/**
 * Issue the standard clinic user dentos_token session (same as password login).
 * Returns { ok: false, denied: true, deleted } when the clinic cannot log in.
 */
export async function issueClinicSession(db, profile, { attachCookie = true } = {}) {
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  const access = canClinicStaffLogin(clinic)
  if (!access.ok) {
    return { ok: false, denied: true, deleted: access.deleted, onboarding_complete: false, token: null }
  }

  const roles = await ensureProfileRolesMigrated(db, profile)
  await db.collection('profiles').updateOne(
    { id: profile.id },
    { $set: { last_login_at: new Date() }, $inc: { login_count: 1 } }
  )
  const token = signToken({
    uid: profile.id,
    cid: profile.clinic_id,
    roles,
    role: roles[0] || profile.role,
  })
  if (attachCookie) setAuthCookie(token)
  return { ok: true, onboarding_complete: !!clinic?.onboarding_complete, token }
}

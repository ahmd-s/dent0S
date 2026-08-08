import { signToken, setAuthCookie } from '@/lib/auth'
import { ensureProfileRolesMigrated } from '@/lib/profile-roles'

/**
 * Issue the standard clinic user dentos_token session (same as password login).
 */
export async function issueClinicSession(db, profile, { attachCookie = true } = {}) {
  const roles = await ensureProfileRolesMigrated(db, profile)
  await db.collection('profiles').updateOne(
    { id: profile.id },
    { $set: { last_login_at: new Date() } }
  )
  const token = signToken({
    uid: profile.id,
    cid: profile.clinic_id,
    roles,
    role: roles[0] || profile.role,
  })
  if (attachCookie) setAuthCookie(token)
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { onboarding_complete: !!clinic?.onboarding_complete, token }
}

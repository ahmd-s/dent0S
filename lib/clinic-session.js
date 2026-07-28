import { signToken, setAuthCookie } from '@/lib/auth'
import { ensureProfileRolesMigrated } from '@/lib/profile-roles'

/**
 * Issue the standard clinic user dentos_token session (same as password login).
 */
export async function issueClinicSession(db, profile) {
  const roles = await ensureProfileRolesMigrated(db, profile)
  await db.collection('profiles').updateOne(
    { id: profile.id },
    { $set: { last_login_at: new Date() } }
  )
  setAuthCookie(
    signToken({
      uid: profile.id,
      cid: profile.clinic_id,
      roles,
      role: roles[0] || profile.role,
    })
  )
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { onboarding_complete: !!clinic?.onboarding_complete }
}

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { getProfileRoles, hasRole } from '@/lib/profile-roles'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function GET() {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const docs = await db.collection('profiles').find({
      clinic_id: cid,
      is_active: true,
      $or: [{ roles: 'doctor' }, { role: 'doctor' }],
    }).toArray()
    return json({
      doctors: docs.filter(d => hasRole(getProfileRoles(d), 'doctor')).map(d => ({
        id: d.id,
        full_name: d.full_name,
        specialization: d.specialization || '',
        profile_photo_url: d.profile_photo_url || '',
        consultation_fee: d.consultation_fee ?? null,
      })),
    })
  } catch (e) {
    console.error('Doctors GET error:', e)
    return err('Internal server error', 500)
  }
}

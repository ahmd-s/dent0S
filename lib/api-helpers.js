import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canAccessClinical } from '@/lib/rbac'
import { getProfileRoles, hasRole } from '@/lib/profile-roles'
import {
  isClinicAccessBlocked,
  clinicAccessPausedResponse,
  guardApiSync,
  guardApi,
  authorizationDenied,
} from '@/lib/authorization-helpers'

export function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
export const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
export const err = (msg, s = 400) => json({ error: msg }, s)
export const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }
export const isReceptionist = p => hasRole(getProfileRoles(p), 'receptionist')
export const clinicalAccess = p => canAccessClinical(getProfileRoles(p))

export {
  isClinicAccessBlocked,
  clinicAccessPausedResponse,
  guardApiSync,
  guardApi,
  authorizationDenied,
}

export async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

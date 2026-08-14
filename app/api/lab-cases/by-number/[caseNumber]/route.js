import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
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
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function PATCH(request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const { profile, db } = ctx
    const clinic_id = profile.clinic_id
    const caseNumber = params.caseNumber.toUpperCase()
    const b = await request.json()
    const allowedStatuses = ['lab_received', 'ready', 'sent', 'completed']
    if (!allowedStatuses.includes(b.status)) return err('Invalid status', 400)

    const labCase = await db.collection('lab_cases').findOne({ case_number: caseNumber, clinic_id })
    if (!labCase) return err('Lab case not found', 404)

    await db.collection('lab_cases').updateOne(
      { case_number: caseNumber, clinic_id },
      {
        $set: { status: b.status, updated_at: new Date() },
        $push: {
          update_log: {
            status: b.status,
            updated_via: b.updated_via || 'whatsapp',
            timestamp: new Date()
          }
        }
      }
    )

    return json({ ok: true, case_number: caseNumber, status: b.status })
  } catch (e) {
    console.error('Lab case by-number PATCH error:', e)
    return err('Internal server error', 500)
  }
}

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const { profile, db } = ctx
    const clinic_id = profile.clinic_id
    const caseNumber = params.caseNumber.toUpperCase()

    const labCase = await db.collection('lab_cases').findOne({ case_number: caseNumber, clinic_id })
    if (!labCase) return err('Lab case not found', 404)
    return json({ lab_case: clean(labCase) })
  } catch (e) {
    console.error('Lab case by-number GET error:', e)
    return err('Internal server error', 500)
  }
}

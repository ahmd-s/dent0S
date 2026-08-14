import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

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
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  return { profile, db }
}

export async function GET() {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx
    const cid = profile.clinic_id

    const visits = await db.collection('visits').find({
      clinic_id: cid,
      workflow_status: { $ne: 'completed' },
      $or: [
        { 'inventory_step.status': 'assigned' },
        { 'invoice_step.status': 'assigned' },
      ],
    }).sort({ updated_at: -1, created_at: -1 }).limit(20).toArray()

    const pids = [...new Set(visits.map(v => v.patient_id).filter(Boolean))]
    const pts = pids.length
      ? await db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).toArray()
      : []
    const pmap = Object.fromEntries(pts.map(p => [p.id, p]))

    const tasks = visits.flatMap(v => {
      const base = {
        visit_id: v.id,
        patient_id: v.patient_id,
        patient_name: pmap[v.patient_id]?.name || 'Unknown',
        doctor_id: v.doctor_id,
      }
      const out = []
      if (v.inventory_step?.status === 'assigned') {
        out.push({ ...base, step: 'inventory', label: 'Complete inventory for visit' })
      }
      if (v.invoice_step?.status === 'assigned') {
        out.push({ ...base, step: 'invoice', label: 'Complete invoice for visit' })
      }
      return out
    })

    return json({ tasks })
  } catch (e) {
    console.error('Pending tasks error:', e)
    return err('Internal server error', 500)
  }
}

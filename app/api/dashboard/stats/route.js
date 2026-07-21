import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { AWAITING_ACCEPTANCE_STATUSES, IN_PRODUCTION_STATUSES, READY_STATUSES, CLOSED_STATUSES } from '@/lib/lab-case-helpers'
import { getProfileRoles } from '@/lib/profile-roles'
import { doctorAppointmentFilter } from '@/lib/doctor-scope'

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
const todayIso = () => new Date().toISOString().slice(0,10)
const yIso = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function GET() {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    const today = todayIso(); const yest = yIso()
    const apptFilter = { clinic_id: cid, appointment_date: today, ...doctorAppointmentFilter(roles, profile.id) }
    const [todayAppts, doneToday, doneYest] = await Promise.all([
      db.collection('appointments').find(apptFilter).sort({ appointment_time: 1 }).toArray(),
      db.collection('appointments').countDocuments({ ...apptFilter, status: 'completed' }),
      db.collection('appointments').countDocuments({ clinic_id: cid, appointment_date: yest, status: 'completed', ...doctorAppointmentFilter(roles, profile.id) }),
    ])
    const pids = [...new Set(todayAppts.map(a=>a.patient_id).filter(Boolean))]
    const dids = [...new Set(todayAppts.map(a=>a.doctor_id).filter(Boolean))]
    const [pts, docs, visits] = await Promise.all([
      pids.length ? db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).toArray() : [],
      dids.length ? db.collection('profiles').find({ id: { $in: dids }, clinic_id: cid }).toArray() : [],
      db.collection('visits').find({ clinic_id: cid, appointment_id: { $in: todayAppts.map(a=>a.id) } }).toArray()
    ])
    const pmap = Object.fromEntries(pts.map(p=>[p.id, { name: p.name, phone: p.phone }]))
    const dmap = Object.fromEntries(docs.map(d=>[d.id,d.full_name]))
    const vmap = Object.fromEntries(visits.map(v=>[v.appointment_id, v.id]))
    const [revAgg, pendAgg] = await Promise.all([
      db.collection('invoices').aggregate([ { $match: { clinic_id: cid, payment_status:'paid', invoice_date: today } }, { $group: { _id:null, sum: { $sum: '$total_amount' } } } ]).toArray(),
      db.collection('invoices').aggregate([ { $match: { clinic_id: cid, payment_status:{ $in:['pending','partial'] }, invoice_date: today } }, { $group: { _id:null, sum: { $sum: '$total_amount' } } } ]).toArray()
    ])
    const followups = await db.collection('patients').find({ clinic_id: cid, is_archived: { $ne: true }, next_followup_date: { $ne: null, $lte: today } }).limit(5).toArray()
    const fcount = await db.collection('patients').countDocuments({ clinic_id: cid, is_archived: { $ne: true }, next_followup_date: { $ne: null, $lte: today } })
    const [activeLabCases, overdueLabCases, awaitingLabAcceptance, inProductionLabCases, readyLabCases] = await Promise.all([
      db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $nin: CLOSED_STATUSES } }),
      db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $nin: CLOSED_STATUSES }, expected_delivery_date: { $ne: null, $lt: today } }),
      db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $in: AWAITING_ACCEPTANCE_STATUSES } }),
      db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $in: IN_PRODUCTION_STATUSES } }),
      db.collection('lab_cases').countDocuments({ clinic_id: cid, status: { $in: READY_STATUSES } }),
    ])
    return json({
      clinic_name: clinic?.name,
      patients_seen_today: doneToday, patients_seen_yesterday: doneYest,
      revenue_today: revAgg[0]?.sum || 0, pending_today: pendAgg[0]?.sum || 0,
      followups_due_count: fcount,
      active_lab_cases: activeLabCases, overdue_lab_cases: overdueLabCases,
      awaiting_lab_acceptance: awaitingLabAcceptance, in_production_lab_cases: inProductionLabCases, ready_lab_cases: readyLabCases,
      today_queue: todayAppts.map(a => ({ ...clean(a), patient_name: pmap[a.patient_id]?.name||a.patient_name_temp, patient_phone: pmap[a.patient_id]?.phone||a.patient_phone_temp, doctor_name: dmap[a.doctor_id]||'', visit_id: vmap[a.id]||null })),
      followups: followups.map(p => ({ ...clean(p), last_visit_reason: '' })),
    })
  } catch (e) {
    console.error('Dashboard stats error:', e)
    return err('Internal server error', 500)
  }
}

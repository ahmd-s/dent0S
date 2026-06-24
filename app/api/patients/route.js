// Path: app/api/patients/route.js
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }
const weekStart = () => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10) }
const monthBack = m => { const d = new Date(); d.setMonth(d.getMonth() - m); return d.toISOString().slice(0, 10) }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

// ── GET /api/patients ────────────────────────────────────────────────────────
export async function GET(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)

    const { profile, db } = user
    const cid = profile.clinic_id
    const url = new URL(request.url)

    const q = url.searchParams.get('q')
    const filter = url.searchParams.get('filter')
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('page_size') || '20')

    const f = { clinic_id: cid, is_archived: { $ne: true } }
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      f.$or = [{ name: re }, { phone: re }, { patient_code: re }]
    }
    if (filter === 'week') f.last_visit_date = { $gte: weekStart() }
    else if (filter === 'month') f.last_visit_date = { $gte: monthBack(1) }
    else if (filter === 'inactive') f.$and = [{ $or: [{ last_visit_date: { $lt: monthBack(3) } }, { last_visit_date: null }] }]

    const [result] = await db.collection('patients').aggregate([
      { $match: f },
      {
        $facet: {
          data: [{ $sort: { created_at: -1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          totalCount: [{ $count: 'total' }]
        }
      }
    ]).toArray()

    const patients = result?.data || []
    const totalCount = result?.totalCount?.[0]?.total || 0
    const totalPages = Math.ceil(totalCount / pageSize)

    return json({
      patients: patients.map(clean),
      pagination: {
        page, page_size: pageSize, total_count: totalCount,
        total_pages: totalPages, has_next: page < totalPages, has_prev: page > 1
      }
    })

  } catch (error) {
    console.error('Patients GET error:', error)
    return err('Internal server error', 500)
  }
}

// ── POST /api/patients ───────────────────────────────────────────────────────
// Rule: same clinic + same phone + same name = duplicate, block it.
// Same phone + different name = allowed (family members).
export async function POST(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)

    const { profile, db } = user
    const cid = profile.clinic_id

    if (profile.role === 'receptionist') return err('Forbidden', 403)

    const b = await request.json()
    if (!b.name || !b.phone) return err('Name and phone required')

    const phone = b.phone.toString().trim().replace(/\D/g, '')
    const name = b.name.trim()
    if (!/^\d{10}$/.test(phone)) return err('Phone must be a 10-digit number')

    // ── Duplicate check: same clinic + same phone + same name ──────────────
    const nameRegex = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    const existing = await db.collection('patients').findOne(
      { clinic_id: cid, phone, name: { $regex: nameRegex }, is_archived: { $ne: true } },
      { projection: { _id: 0 } }
    )
    if (existing) {
      // Same person already exists — return their record with a clear message
      return json({
        ok: true,
        id: existing.id,
        patient: clean(existing),
        existing: true,
        message: 'A patient with this name and phone already exists.'
      })
    }

    // ── Generate patient code via atomic counter ────────────────────────────
    const counter = await db.collection('counters').findOneAndUpdate(
      { clinic_id: cid, type: 'patient' },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after' }
    )
    const seq = counter?.sequence ?? 1
    const patientCode = 'PT' + String(seq).padStart(5, '0')

    const id = uuidv4()

    try {
      await db.collection('patients').insertOne({
        id,
        clinic_id: cid,
        name,
        phone,
        dob: b.dob || null,
        age: b.age ? parseInt(b.age) : null,
        gender: b.gender || '',
        blood_group: b.blood_group || '',
        allergies: b.allergies || '',
        medical_history: b.medical_history || '',
        address: b.address || '',
        referral_source: b.referral_source || '',
        patient_code: patientCode,
        total_visits: 0,
        is_archived: false,
        created_by: profile.id,
        created_via: 'internal_dashboard',
        created_at: new Date()
      })
    } catch (insertErr) {
      // Unique index violation — race condition
      if (insertErr.code === 11000) {
        const raceExisting = await db.collection('patients').findOne(
          { clinic_id: cid, phone, name: { $regex: nameRegex } }
        )
        if (raceExisting) {
          return json({ ok: true, id: raceExisting.id, patient: clean(raceExisting), existing: true })
        }
      }
      throw insertErr
    }

    return json({ ok: true, id, existing: false }, 201)

  } catch (error) {
    console.error('Patient creation error:', error)
    return err('Internal server error', 500)
  }
}
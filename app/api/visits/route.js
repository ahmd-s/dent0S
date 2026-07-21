import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getProfileRoles } from '@/lib/profile-roles'
import {
  doctorVisitFilter,
  shouldScopeToDoctor,
} from '@/lib/doctor-scope'
import { initVisitWorkflowFields } from '@/lib/visit-completion'
import { nextPatientCode } from '@/lib/patient-code'

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
const initials = name => (name||'').split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,3) || 'CL'

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    const url = new URL(request.url)
    const patient_id = url.searchParams.get('patient_id')
    const f = { clinic_id: cid, ...doctorVisitFilter(roles, profile.id) }
    if (patient_id) f.patient_id = patient_id
    const list = await db.collection('visits').find(f).sort({ visit_date: -1, created_at: -1 }).toArray()
    const uniqueList = Array.from(new Map(list.map(v => [v.id, v])).values())
    const dids = [...new Set(uniqueList.map(v=>v.doctor_id).filter(Boolean))]
    const docs = dids.length ? await db.collection('profiles').find({ id: { $in: dids }, clinic_id: cid }).toArray() : []
    const dmap = Object.fromEntries(docs.map(d=>[d.id,d.full_name]))
    const rxs = await db.collection('prescriptions').find({ clinic_id: cid, visit_id: { $in: uniqueList.map(v=>v.id) } }).toArray()
    const rxmap = {}; for (const r of rxs) (rxmap[r.visit_id] = rxmap[r.visit_id]||[]).push(clean(r))
    return json({ visits: uniqueList.map(v => { const { prescriptions: _vRx, ...cleanV } = clean(v); return { ...cleanV, doctor_name: dmap[v.doctor_id]||'', prescriptions: rxmap[v.id]||[] } }) })
  } catch (e) {
    console.error('Visits GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    if (!hasPermission(profile, 'visits', 'create')) return err('Forbidden', 403)
    const b = await request.json()
    const doctorId = b.doctor_id || profile.id

    if (!b.patient_id && b.appointment_id) {
      const appointment = await db.collection('appointments').findOne({ id: b.appointment_id, clinic_id: cid })
      if (appointment) {
        let patientId = null
        if (appointment.visitor_type === 'new') {
          if (appointment.patient_phone_temp && appointment.patient_name_temp) {
            const searchName = appointment.patient_name_temp.toLowerCase().trim()
            const existingPatient = await db.collection('patients').findOne({ phone: appointment.patient_phone_temp, clinic_id: cid })
            if (existingPatient) {
              const existingName = (existingPatient.name || '').toLowerCase().trim()
              const nameMatches = existingName === searchName || existingName.includes(searchName) || searchName.includes(existingName)
              if (nameMatches) {
                patientId = existingPatient.id
                await db.collection('appointments').updateOne({ id: appointment.id }, { $set: { patient_id: patientId, visitor_type: 'new_auto_matched' } })
              }
            }
          }
          if (!patientId) {
            patientId = uuidv4()
            const code = await nextPatientCode(db, cid)
            await db.collection('patients').insertOne({
              id: patientId, clinic_id: cid, name: appointment.patient_name_temp || 'Unknown',
              phone: appointment.patient_phone_temp || '', patient_code: code, total_visits: 0,
              is_archived: false, created_by: profile.id, created_at: new Date(),
            })
            await db.collection('appointments').updateOne({ id: appointment.id }, { $set: { patient_id: patientId } })
          }
        } else if (appointment.visitor_type === 'returning_unmatched') {
          return err('returning_unmatched', 400)
        } else {
          if (appointment.patient_id) {
            patientId = appointment.patient_id
          } else if (appointment.patient_phone_temp) {
            const existingPatient = await db.collection('patients').findOne({ phone: appointment.patient_phone_temp, clinic_id: cid })
            if (existingPatient) {
              patientId = existingPatient.id
              await db.collection('appointments').updateOne({ id: appointment.id }, { $set: { patient_id: patientId } })
            }
          }
          if (!patientId) {
            patientId = uuidv4()
            const code = await nextPatientCode(db, cid)
            await db.collection('patients').insertOne({
              id: patientId, clinic_id: cid, name: appointment.patient_name_temp || 'Unknown',
              phone: appointment.patient_phone_temp || '', patient_code: code, total_visits: 0,
              is_archived: false, created_by: profile.id, created_at: new Date(),
            })
            await db.collection('appointments').updateOne({ id: appointment.id }, { $set: { patient_id: patientId } })
          }
        }
        b.patient_id = patientId
      }
    }

    if (!b.patient_id) return err('patient_id required')
    if (shouldScopeToDoctor(roles) && doctorId !== profile.id) return err('Forbidden', 403)

    const id = uuidv4()
    await db.collection('visits').insertOne({
      id, clinic_id: cid, patient_id: b.patient_id, doctor_id: doctorId,
      appointment_id: b.appointment_id||null, visit_date: todayIso(),
      chief_complaint: b.chief_complaint||'', clinical_notes:'', diagnosis:'',
      treatment_done:'', treatment_plan:'', next_visit_recommended:false, next_visit_date:null,
      ...initVisitWorkflowFields(),
      created_at: new Date(),
    })

    const docProfile = await db.collection('profiles').findOne({ id: doctorId, clinic_id: cid })
    if (docProfile?.consultation_fee != null && docProfile.consultation_fee > 0) {
      const invoiceId = uuidv4()
      const count = await db.collection('invoices').countDocuments({ clinic_id: cid })
      const invoice_number = `INV-${initials(clinic.name)}-${String(count+1).padStart(5,'0')}`
      const fee = parseFloat(docProfile.consultation_fee)
      await db.collection('invoices').insertOne({
        id: invoiceId, clinic_id: cid, patient_id: b.patient_id, visit_id: id,
        invoice_number, invoice_date: todayIso(), share_token: uuidv4(),
        subtotal: fee, discount: 0, gst_amount: 0, total_amount: fee,
        payment_status: 'pending', payment_mode: null, notes: '', created_at: new Date(),
      })
      await db.collection('invoice_items').insertOne({
        id: uuidv4(), clinic_id: cid, invoice_id: invoiceId,
        description: 'Consultation', quantity: 1, unit_price: fee, total: fee,
      })
    }

    if (b.appointment_id) {
      await db.collection('appointments').updateOne({ id: b.appointment_id, clinic_id: cid }, { $set: { status: 'in_progress' } })
    }
    return json({ ok:true, id })
  } catch (e) {
    console.error('Visits POST error:', e)
    return err('Internal server error', 500)
  }
}

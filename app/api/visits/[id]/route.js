import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { stripInvoiceAuditFields } from '@/lib/invoice-audit'
import { v4 as uuidv4 } from 'uuid'
import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

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
const todayIso = () => new Date().toISOString().slice(0, 10)
const initials = name => (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 3) || 'CL'

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function GET(request, { params }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { profile, db } = user
  const cid = profile.clinic_id
  const id = params.id

  const v = await db.collection('visits').findOne({ id, clinic_id: cid })
  if (!v) return err('Not found', 404)
  const [p, doc, rxs, prevList, inv] = await Promise.all([
    db.collection('patients').findOne({ id: v.patient_id, clinic_id: cid }),
    v.doctor_id ? db.collection('profiles').findOne({ id: v.doctor_id, clinic_id: cid }) : null,
    db.collection('prescriptions').find({ visit_id: v.id, clinic_id: cid }).toArray(),
    db.collection('visits').find({ patient_id: v.patient_id, clinic_id: cid, id: { $ne: v.id } }).sort({ visit_date: -1, created_at: -1 }).limit(1).toArray(),
    db.collection('invoices').findOne({ visit_id: v.id, clinic_id: cid })
  ])
  const items = inv ? await db.collection('invoice_items').find({ invoice_id: inv.id, clinic_id: cid }).toArray() : []
  const { items: _invItems, ...cleanInv } = inv ? clean(inv) : {}
  const { prescriptions: _vRx, ...cleanV } = clean(v)
  return json({ visit: { ...cleanV, patient: clean(p), doctor_name: doc?.full_name || '', prescriptions: rxs.map(clean), previous_visit: prevList[0] ? clean(prevList[0]) : null, invoice: inv ? stripInvoiceAuditFields({ ...cleanInv, items: items.map(clean) }) : null } })
}

export async function PUT(request, { params }) {
  const user = await requireUser()
  if (!user) return err('Unauthorized', 401)

  const { profile, db, clinic } = user
  const cid = profile.clinic_id
  const id = params.id

  if (!hasPermission(profile.role, 'visits', 'update')) return err('Forbidden', 403)
  const b = await request.json()
  const visit = await db.collection('visits').findOne({ id, clinic_id: cid })
  if (!visit) return err('Not found', 404)

  const allowed = ['chief_complaint', 'clinical_notes', 'diagnosis', 'treatment_done', 'treatment_plan', 'next_visit_recommended', 'next_visit_date']
  const update = {}
  for (const k of allowed) if (k in b) update[k] = b[k]
  await db.collection('visits').updateOne({ id, clinic_id: cid }, { $set: update })
  // replace prescriptions
  if (Array.isArray(b.prescriptions)) {
    await db.collection('prescriptions').deleteMany({ visit_id: id, clinic_id: cid })
    const valid = b.prescriptions.filter(r => r.medicine_name?.trim())
    if (valid.length) {
      await db.collection('prescriptions').insertMany(valid.map(r => ({ id: uuidv4(), clinic_id: cid, visit_id: id, medicine_name: r.medicine_name, dosage: r.dosage || '', frequency: r.frequency || '', duration: r.duration || '', instructions: r.instructions || '', created_at: new Date() })))
      await logActivity(db, profile, ACTIVITY_EVENTS.PRESCRIPTION_CREATED, {
        patientId: visit.patient_id,
        visitId: id,
        metadata: { count: valid.length },
      })
    }
  }
  // upsert invoice items + invoice (draft mode)
  let invoiceId = null
  let invoiceCreated = false
  if (Array.isArray(b.invoice_items) || b.invoice) {
    const existing = await db.collection('invoices').findOne({ visit_id: id, clinic_id: cid })
    const items = (b.invoice_items || []).filter(it => it.description?.trim())
    const subtotal = items.reduce((s, it) => s + (parseFloat(it.unit_price) || 0) * (parseInt(it.quantity) || 1), 0)
    const discount = parseFloat(b.discount) || 0
    const gst = b.gst_enabled ? Math.round((subtotal - discount) * 0.18 * 100) / 100 : 0
    const total = Math.max(0, subtotal - discount + gst)
    const invoiceData = { subtotal, discount, gst_amount: gst, total_amount: total, payment_status: b.payment_status || 'pending', payment_mode: b.payment_mode || null, notes: b.invoice_notes || '' }
    if (existing) {
      await db.collection('invoices').updateOne({ id: existing.id, clinic_id: cid }, { $set: invoiceData })
      await db.collection('invoice_items').deleteMany({ invoice_id: existing.id, clinic_id: cid })
      invoiceId = existing.id
      if (b.payment_status === 'paid' && existing.payment_status !== 'paid') {
        await logActivity(db, profile, ACTIVITY_EVENTS.PAYMENT_RECEIVED, {
          patientId: visit.patient_id,
          visitId: id,
          invoiceId: existing.id,
          metadata: { amount: total, invoice_number: existing.invoice_number },
        })
      }
    } else {
      invoiceId = uuidv4()
      invoiceCreated = true
      const count = await db.collection('invoices').countDocuments({ clinic_id: cid })
      const invoice_number = `INV-${initials(clinic.name)}-${String(count + 1).padStart(5, '0')}`
      const share_token = uuidv4()
      await db.collection('invoices').insertOne({ id: invoiceId, clinic_id: cid, patient_id: visit.patient_id, visit_id: visit.id, invoice_number, invoice_date: todayIso(), share_token, ...invoiceData, created_at: new Date() })
    }
    if (items.length) {
      await db.collection('invoice_items').insertMany(items.map(it => ({ id: uuidv4(), clinic_id: cid, invoice_id: invoiceId, description: it.description, quantity: parseInt(it.quantity) || 1, unit_price: parseFloat(it.unit_price) || 0, total: (parseFloat(it.unit_price) || 0) * (parseInt(it.quantity) || 1) })))
    }
    if (invoiceCreated) {
      const inv = await db.collection('invoices').findOne({ id: invoiceId, clinic_id: cid })
      await logActivity(db, profile, ACTIVITY_EVENTS.INVOICE_CREATED, {
        patientId: visit.patient_id,
        visitId: id,
        invoiceId,
        metadata: { invoice_number: inv?.invoice_number, amount: inv?.total_amount },
      })
    }
  }
  // complete-visit side effects
  if (b.complete) {
    if (!visit.chief_complaint && !b.chief_complaint) return err('Chief complaint required to complete')
    if (visit?.appointment_id) {
      await db.collection('appointments').updateOne({ id: visit.appointment_id, clinic_id: cid }, { $set: { status: 'completed' } })
      await logActivity(db, profile, ACTIVITY_EVENTS.APPOINTMENT_COMPLETED, {
        patientId: visit.patient_id,
        appointmentId: visit.appointment_id,
        visitId: id,
      })
    }
    await db.collection('patients').updateOne({ id: visit.patient_id, clinic_id: cid }, { $set: { last_visit_date: visit.visit_date, next_followup_date: b.next_visit_recommended ? b.next_visit_date : null }, $inc: { total_visits: 1 } })
    await logActivity(db, profile, ACTIVITY_EVENTS.VISIT_COMPLETED, {
      patientId: visit.patient_id,
      visitId: id,
      appointmentId: visit.appointment_id,
    })
  }
  return json({ ok: true, invoice_id: invoiceId })
}

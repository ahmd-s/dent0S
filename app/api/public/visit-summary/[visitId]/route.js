import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

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
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function GET(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const { profile, db } = ctx
  const clinic_id = profile.clinic_id
  const { visitId } = params

  try {
    // Scope the visit lookup to the authenticated clinic
    const visit = await db.collection('visits').findOne({ id: visitId, clinic_id })
    if (!visit) return err('Not found', 404)

    // Fetch related data with individual error handling
    let clinic, patient, doctor, prescriptions, invoice, invoice_items
    try {
      clinic = await db.collection('clinics').findOne({ id: visit.clinic_id })
    } catch (e) { console.error('Error fetching clinic:', e) }
    try {
      patient = await db.collection('patients').findOne({ id: visit.patient_id, clinic_id })
    } catch (e) { console.error('Error fetching patient:', e) }
    try {
      doctor = visit.doctor_id ? await db.collection('profiles').findOne({ id: visit.doctor_id, clinic_id }) : null
    } catch (e) { console.error('Error fetching doctor:', e) }
    try {
      prescriptions = await db.collection('prescriptions').find({ visit_id: visit.id, clinic_id }).toArray()
    } catch (e) { console.error('Error fetching prescriptions:', e); prescriptions = [] }
    try {
      invoice = await db.collection('invoices').findOne({ visit_id: visit.id, clinic_id })
    } catch (e) { console.error('Error fetching invoice:', e) }
    try {
      invoice_items = invoice ? await db.collection('invoice_items').find({ invoice_id: invoice.id, clinic_id }).toArray() : []
    } catch (e) { console.error('Error fetching invoice items:', e); invoice_items = [] }

    if (!clinic) return err('Clinic not found', 404)
    if (!patient) return err('Patient not found', 404)

    const doctor_name = doctor?.full_name || ''

    return json({
      visit: {
        visit_date: visit.visit_date,
        treatment_done: visit.treatment_done,
        doctor_name
      },
      patient: {
        name: patient.name
      },
      clinic: {
        name: clinic.name,
        address: clinic.address,
        city: clinic.city,
        phone: clinic.phone
      },
      prescriptions: (prescriptions || []).map(clean),
      invoice: invoice ? {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        payment_status: invoice.payment_status,
        payment_mode: invoice.payment_mode,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        gst_amount: invoice.gst_amount,
        total_amount: invoice.total_amount,
        items: (invoice_items || []).map(clean)
      } : null
    })
  } catch (e) {
    console.error('Visit summary API error:', e)
    return err('Internal server error', 500)
  }
}

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

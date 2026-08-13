import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { isShareTokenValid } from '@/lib/communication/secure-links'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return res
}

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }

export async function GET(_request, { params }) {
  try {
    const db = await getDb()
    const shareToken = params.visitId || params.shareToken

    const visit = await db.collection('visits').findOne({ share_token: shareToken })
    if (!visit || !isShareTokenValid(visit)) return err('Not found', 404)

    const clinicId = visit.clinic_id
    const [clinic, patient, doctor, prescriptions, invoice, invoiceItems] = await Promise.all([
      db.collection('clinics').findOne({ id: clinicId }),
      db.collection('patients').findOne({ id: visit.patient_id, clinic_id: clinicId }),
      visit.doctor_id ? db.collection('profiles').findOne({ id: visit.doctor_id, clinic_id: clinicId }) : null,
      db.collection('prescriptions').find({ visit_id: visit.id, clinic_id: clinicId }).toArray(),
      db.collection('invoices').findOne({ visit_id: visit.id, clinic_id: clinicId }),
      db.collection('invoices').findOne({ visit_id: visit.id, clinic_id: clinicId }).then(async (inv) => {
        if (!inv) return []
        return db.collection('invoice_items').find({ invoice_id: inv.id, clinic_id: clinicId }).toArray()
      }),
    ])

    if (!clinic || !patient) return err('Not found', 404)

    return json({
      visit: {
        visit_date: visit.visit_date,
        treatment_done: visit.treatment_done,
        doctor_name: doctor?.full_name || '',
      },
      patient: { name: patient.name },
      clinic: {
        name: clinic.name,
        address: clinic.address,
        city: clinic.city,
        phone: clinic.phone,
        logo_url: clinic.logo_url,
      },
      prescriptions: prescriptions.map(clean),
      invoice: invoice ? {
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        payment_status: invoice.payment_status,
        payment_mode: invoice.payment_mode,
        subtotal: invoice.subtotal,
        discount: invoice.discount,
        gst_amount: invoice.gst_amount,
        total_amount: invoice.total_amount,
        items: invoiceItems.map(clean),
        share_token: invoice.share_token,
      } : null,
    })
  } catch (e) {
    console.error('Public visit summary error')
    return err('Internal server error', 500)
  }
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

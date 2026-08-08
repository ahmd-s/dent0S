import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canManageBilling, canEditInvoiceDate } from '@/lib/rbac'
import {
  buildDateHistoryEntry,
  enrichInvoiceAudit,
  isValidIsoDate,
  stripInvoiceAuditFields,
  todayIso,
} from '@/lib/invoice-audit'

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

async function loadInvoiceDetail(db, inv, cid) {
  const [p, items, visit] = await Promise.all([
    db.collection('patients').findOne({ id: inv.patient_id, clinic_id: cid }),
    db.collection('invoice_items').find({ invoice_id: inv.id, clinic_id: cid }).toArray(),
    inv.visit_id ? db.collection('visits').findOne({ id: inv.visit_id, clinic_id: cid }) : null,
  ])
  const doctor = visit?.doctor_id ? await db.collection('profiles').findOne({ id: visit.doctor_id, clinic_id: cid }) : null
  const clinic = await db.collection('clinics').findOne({ id: cid })
  const { items: _invItems, ...cleanInv } = clean(inv)
  return {
    ...cleanInv,
    patient: clean(p),
    items: items.map(clean),
    visit: visit ? clean(visit) : null,
    doctor_name: doctor?.full_name || '',
    clinic: clean(clinic),
  }
}

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const inv = await db.collection('invoices').findOne({ id: params.id, clinic_id: cid })
    if (!inv) return err('Not found', 404)

    let invoice = await loadInvoiceDetail(db, inv, cid)
    if (canEditInvoiceDate(profile)) {
      invoice = await enrichInvoiceAudit(db, invoice, cid)
    } else {
      invoice = stripInvoiceAuditFields(invoice)
    }
    return json({ invoice })
  } catch (e) {
    console.error('Invoice GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const b = await request.json()

    if ('invoice_date' in b) {
      if (!canEditInvoiceDate(profile)) return err('Forbidden', 403)

      const inv = await db.collection('invoices').findOne({ id: params.id, clinic_id: cid })
      if (!inv) return err('Not found', 404)

      const reason = (b.invoice_date_update_reason || '').trim()
      if (!reason) return err('Reason is required', 400)

      const newDate = b.invoice_date
      if (!isValidIsoDate(newDate)) return err('Invalid date', 400)
      if (newDate > todayIso()) return err('Future dates are not allowed', 400)
      if (newDate === inv.invoice_date) return err('New date must differ from current invoice date', 400)

      const historyEntry = buildDateHistoryEntry({
        fromDate: inv.invoice_date,
        toDate: newDate,
        profileId: profile.id,
        reason,
      })
      const history = [...(inv.invoice_date_history || []), historyEntry]
      const now = new Date()

      const update = {
        invoice_date: newDate,
        invoice_date_history: history,
        invoice_date_updated_at: now,
        invoice_date_updated_by: profile.id,
        invoice_date_update_reason: reason,
      }
      if (!inv.invoice_date_original) {
        update.invoice_date_original = inv.invoice_date
      }

      await db.collection('invoices').updateOne({ id: params.id, clinic_id: cid }, { $set: update })

      const updated = await db.collection('invoices').findOne({ id: params.id, clinic_id: cid })
      let invoice = await loadInvoiceDetail(db, updated, cid)
      invoice = await enrichInvoiceAudit(db, invoice, cid)
      return json({ invoice })
    }

    const u = {}
    if ('payment_status' in b) u.payment_status = b.payment_status
    if ('payment_mode' in b) u.payment_mode = b.payment_mode
    if ('notes' in b) u.notes = b.notes
    await db.collection('invoices').updateOne({ id: params.id, clinic_id: cid }, { $set: u })
    return json({ ok: true })
  } catch (e) {
    console.error('Invoice PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function PATCH(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const b = await request.json()
    if (b.generate_share_token) {
      const inv = await db.collection('invoices').findOne({ id: params.id, clinic_id: cid })
      if (!inv) return err('Not found', 404)
      if (!inv.share_token) {
        const share_token = uuidv4()
        await db.collection('invoices').updateOne({ id: params.id, clinic_id: cid }, { $set: { share_token } })
      }
      return json({ ok: true })
    }
    return err('Invalid request')
  } catch (e) {
    console.error('Invoice PATCH error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canManageBilling(profile)) return err('Forbidden', 403)
    const inv = await db.collection('invoices').findOne({ id: params.id, clinic_id: cid })
    if (!inv) return err('Not found', 404)
    await db.collection('invoice_items').deleteMany({ invoice_id: inv.id, clinic_id: cid })
    await db.collection('invoices').deleteOne({ id: inv.id, clinic_id: cid })
    return json({ ok: true })
  } catch (e) {
    console.error('Invoice DELETE error:', e)
    return err('Internal server error', 500)
  }
}

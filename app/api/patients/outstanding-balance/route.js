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

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

const UNPAID_STATUSES = ['pending', 'partial']
const MAX_BATCH_IDS = 100

/**
 * Totals only, for many patients in one round-trip.
 *
 * The balance badge renders once per row, and each instance used to call this
 * route with a single `patient_id` — a 20-row appointment queue meant 20
 * requests, each re-resolving the session and returning full invoice documents
 * to display one number.
 */
async function batchBalances(db, cid, ids) {
  const rows = await db.collection('invoices').aggregate([
    {
      $match: {
        clinic_id: cid,
        patient_id: { $in: ids },
        payment_status: { $in: UNPAID_STATUSES },
      },
    },
    { $group: { _id: '$patient_id', outstanding: { $sum: { $ifNull: ['$total_amount', 0] } } } },
  ]).toArray()

  // Patients with nothing outstanding must still be present, otherwise the
  // client cannot tell "zero" from "not yet loaded" and would re-request.
  const balances = Object.fromEntries(ids.map(id => [id, 0]))
  for (const r of rows) balances[r._id] = r.outstanding
  return balances
}

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const url = new URL(request.url)

    const idsParam = url.searchParams.get('patient_ids')
    if (idsParam) {
      const ids = [...new Set(idsParam.split(',').map(s => s.trim()).filter(Boolean))]
      if (ids.length === 0) return err('patient_ids required')
      if (ids.length > MAX_BATCH_IDS) return err(`patient_ids limited to ${MAX_BATCH_IDS}`)
      return json({ balances: await batchBalances(db, cid, ids) })
    }

    const patient_id = url.searchParams.get('patient_id')
    if (!patient_id) return err('patient_id required')

    const invoices = await db.collection('invoices').find({
      clinic_id: cid,
      patient_id: patient_id,
      payment_status: { $in: UNPAID_STATUSES }
    }).sort({ invoice_date: -1 }).toArray()
    
    const unpaidInvoices = invoices.map(inv => {
      const pending_amount = (inv.total_amount || 0)
      return {
        _id: inv.id,
        invoice_number: inv.invoice_number,
        date: inv.invoice_date,
        total_amount: inv.total_amount,
        pending_amount: pending_amount,
        payment_status: inv.payment_status
      }
    })
    
    const outstandingBalance = unpaidInvoices.reduce((sum, inv) => sum + inv.pending_amount, 0)
    
    return json({ 
      outstandingBalance, 
      unpaidInvoices 
    })
  } catch (e) {
    console.error('Outstanding balance error:', e)
    return err('Internal server error', 500)
  }
}

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { stripInvoiceAuditFields } from '@/lib/invoice-audit'
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
const monthBack = m => { const d = new Date(); d.setMonth(d.getMonth()-m); return d.toISOString().slice(0,10) }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const from = url.searchParams.get('from'); const to = url.searchParams.get('to')
    const q = url.searchParams.get('q')
    const patient_id = url.searchParams.get('patient_id')
    const f = { clinic_id: cid }
    if (status && status !== 'all') f.payment_status = status
    if (patient_id) f.patient_id = patient_id
    if (from || to) { f.invoice_date = {}; if (from) f.invoice_date.$gte = from; if (to) f.invoice_date.$lte = to }
    const list = await db.collection('invoices').find(f).sort({ invoice_date: -1, created_at: -1 }).toArray()
    const pids = [...new Set(list.map(i=>i.patient_id).filter(Boolean))]
    const pts = pids.length ? await db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).toArray() : []
    let pmap = Object.fromEntries(pts.map(p=>[p.id, p.name]))
    let arr = list.map(i => stripInvoiceAuditFields({ ...clean(i), patient_name: pmap[i.patient_id] || '—' }))
    if (q) { const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i'); arr = arr.filter(i => re.test(i.patient_name) || re.test(i.invoice_number||'')) }
    // monthly summary
    const mStart = monthBack(1)
    const monthInv = await db.collection('invoices').find({ clinic_id: cid, invoice_date: { $gte: mStart } }).toArray()
    const summary = {
      collected: monthInv.filter(i=>i.payment_status==='paid').reduce((s,i)=>s+(i.total_amount||0),0),
      pending: monthInv.filter(i=>['pending','partial'].includes(i.payment_status)).reduce((s,i)=>s+(i.total_amount||0),0),
      total: monthInv.reduce((s,i)=>s+(i.total_amount||0),0),
    }
    return json({ invoices: arr, summary })
  } catch (e) {
    console.error('Invoices GET error:', e)
    return err('Internal server error', 500)
  }
}

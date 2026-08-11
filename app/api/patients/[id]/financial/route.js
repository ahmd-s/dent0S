import { requireUser, json, err, clean } from '@/lib/api-helpers'

export async function GET(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const cid = ctx.profile.clinic_id
  const patientId = params.id

  const patient = await ctx.db.collection('patients').findOne({ id: patientId, clinic_id: cid })
  if (!patient) return err('Not found', 404)

  const invoices = await ctx.db.collection('invoices')
    .find({ clinic_id: cid, patient_id: patientId })
    .sort({ invoice_date: -1, created_at: -1 })
    .toArray()

  const outstanding = invoices
    .filter(i => ['pending', 'partial'].includes(i.payment_status))
    .reduce((s, i) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0)

  const paid = invoices
    .filter(i => i.payment_status === 'paid')
    .reduce((s, i) => s + (i.total_amount || 0), 0)

  const total = invoices.reduce((s, i) => s + (i.total_amount || 0), 0)

  return json({
    ok: true,
    summary: {
      outstanding,
      paid,
      total,
      invoice_count: invoices.length,
      pending_count: invoices.filter(i => ['pending', 'partial'].includes(i.payment_status)).length,
    },
    invoices: invoices.map(i => clean({
      ...i,
      balance_due: (i.total_amount || 0) - (i.amount_paid || 0),
    })),
  })
}

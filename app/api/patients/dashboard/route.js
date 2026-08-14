import { requireUser, json, err } from '@/lib/api-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

/**
 * GET /api/patients/dashboard
 * Patient-centric dashboard data for Clinical Workspace widgets.
 */
export async function GET() {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const cid = ctx.profile.clinic_id
  const today = new Date().toISOString().slice(0, 10)

  const [followups, allergyPatients, balanceAgg, activeVisits, openLab] = await Promise.all([
    ctx.db.collection('patients').find({
      clinic_id: cid,
      is_archived: { $ne: true },
      next_followup_date: { $ne: null, $lte: today },
    }).project({ _id: 0, id: 1, name: 1, phone: 1, next_followup_date: 1 }).sort({ next_followup_date: 1 }).limit(8).toArray(),

    ctx.db.collection('patients').find({
      clinic_id: cid,
      is_archived: { $ne: true },
      allergies: { $nin: [null, ''] },
    }).project({ _id: 0, id: 1, name: 1, allergies: 1 }).sort({ updated_at: -1, created_at: -1 }).limit(8).toArray(),

    ctx.db.collection('invoices').aggregate([
      { $match: { clinic_id: cid, payment_status: { $in: ['pending', 'partial'] } } },
      { $group: { _id: '$patient_id', total: { $sum: { $subtract: ['$total_amount', { $ifNull: ['$amount_paid', 0] }] } } } },
      { $match: { total: { $gt: 0 } } },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]).toArray(),

    ctx.db.collection('visits').find({
      clinic_id: cid,
      visit_date: today,
    }).project({ _id: 0, id: 1, patient_id: 1, chief_complaint: 1, visit_date: 1 }).sort({ created_at: -1 }).limit(10).toArray(),

    ctx.db.collection('lab_cases').find({
      clinic_id: cid,
      status: { $nin: ['delivered', 'cancelled'] },
    }).project({
      _id: 0,
      id: 1,
      patient_id: 1,
      case_number: 1,
      status: 1,
      expected_delivery_date: 1,
    }).sort({ expected_delivery_date: 1 }).limit(8).toArray(),
  ])

  const balancePatientIds = balanceAgg.map(b => b._id).filter(Boolean)
  const activePids = [...new Set(activeVisits.map(v => v.patient_id))]
  const labPids = [...new Set(openLab.map(l => l.patient_id))]
  const allPids = [...new Set([...balancePatientIds, ...activePids, ...labPids])]

  const relatedPatients = allPids.length
    ? await ctx.db.collection('patients')
      .find({ id: { $in: allPids }, clinic_id: cid })
      .project({ _id: 0, id: 1, name: 1 })
      .toArray()
    : []
  const nameMap = Object.fromEntries(relatedPatients.map(p => [p.id, p]))

  const critical = []
  for (const p of allergyPatients) {
    critical.push({ id: p.id, name: p.name, reason: 'Allergies', detail: p.allergies?.slice(0, 60) })
  }
  for (const b of balanceAgg) {
    if (critical.length >= 8) break
    const p = nameMap[b._id]
    if (p && !critical.find(c => c.id === p.id)) {
      critical.push({ id: p.id, name: p.name, reason: 'Outstanding Balance', detail: `₹${Math.round(b.total).toLocaleString('en-IN')}` })
    }
  }

  return json({
    ok: true,
    followups_today: followups.map(p => ({
      id: p.id,
      name: p.name,
      next_followup_date: p.next_followup_date,
      phone: p.phone,
    })),
    critical_patients: critical.slice(0, 8),
    active_treatments: activeVisits.map(v => ({
      visit_id: v.id,
      patient_id: v.patient_id,
      patient_name: nameMap[v.patient_id]?.name || '—',
      chief_complaint: v.chief_complaint || '',
      visit_date: v.visit_date,
    })),
    pending_lab: openLab.map(l => ({
      id: l.id,
      patient_id: l.patient_id,
      patient_name: nameMap[l.patient_id]?.name || '—',
      case_number: l.case_number,
      status: l.status,
      expected_delivery_date: l.expected_delivery_date,
    })),
  })
}

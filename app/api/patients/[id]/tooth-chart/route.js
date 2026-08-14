import { requireUser, json, err, clean } from '@/lib/api-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const cid = ctx.profile.clinic_id
  const patientId = params.id

  const patient = await ctx.db.collection('patients').findOne({ id: patientId, clinic_id: cid })
  if (!patient) return err('Not found', 404)

  const visits = await ctx.db.collection('visits')
    .find({ clinic_id: cid, patient_id: patientId })
    .sort({ visit_date: -1, created_at: -1 })
    .limit(20)
    .toArray()

  let latestChart = null
  let latestVisitId = null

  for (const v of visits) {
    const chart = await ctx.db.collection('tooth_charts').findOne({
      clinic_id: cid,
      visit_id: v.id,
    })
    if (chart?.teeth && Object.keys(chart.teeth).length > 0) {
      latestChart = clean(chart)
      latestVisitId = v.id
      break
    }
  }

  const history = []
  for (const v of visits.slice(0, 10)) {
    const chart = await ctx.db.collection('tooth_charts').findOne({ clinic_id: cid, visit_id: v.id })
    if (chart?.teeth) {
      history.push({
        visit_id: v.id,
        visit_date: v.visit_date,
        teeth_count: Object.keys(chart.teeth).length,
        last_updated: chart.last_updated,
      })
    }
  }

  return json({
    ok: true,
    chart: latestChart,
    visit_id: latestVisitId,
    history,
  })
}

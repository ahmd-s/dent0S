/**
 * Analytics Engine — single source of truth for clinic BI (Sprint 16).
 * All business analytics calculations live here. API routes must delegate.
 */

import { computeFlowMetrics } from '@/lib/dental-flow-engine'
import { computeLabMetricsLite } from '@/lib/lab-workflow-engine'
import { computeInventoryMetricsLite } from '@/lib/inventory-workflow-engine'
import { computeCommunicationMetrics } from '@/lib/communication-engine'
import { computeAIMetrics } from '@/lib/ai-engine'

const CACHE_TTL_MS = 60_000
const cache = new Map()
const coreDataCache = new Map()
const coreDataInflight = new Map()

function cacheKey(clinicId, fn, opts = {}) {
  return `${clinicId}:${fn}:${JSON.stringify(opts)}`
}

function getCached(key) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data
  return null
}

function setCache(key, data) {
  cache.set(key, { data, at: Date.now() })
  if (cache.size > 200) {
    const oldest = cache.keys().next().value
    cache.delete(oldest)
  }
}

function coreDataKey(clinicId, range) {
  const start = range.start.toISOString().slice(0, 10)
  const end = range.end.toISOString().slice(0, 10)
  return `${clinicId}:${start}:${end}`
}

function clearCoreDataCache(clinicId = null) {
  if (!clinicId) {
    coreDataCache.clear()
    coreDataInflight.clear()
    return
  }
  for (const key of [...coreDataCache.keys()]) {
    if (key.startsWith(`${clinicId}:`)) coreDataCache.delete(key)
  }
  for (const key of [...coreDataInflight.keys()]) {
    if (key.startsWith(`${clinicId}:`)) coreDataInflight.delete(key)
  }
}

/** Sprint 19 — invalidate analytics cache (all clinics or one clinic). */
export function invalidateAnalyticsCache(clinicId = null) {
  clearCoreDataCache(clinicId)
  if (!clinicId) {
    cache.clear()
    return { cleared: 'all' }
  }
  let removed = 0
  for (const key of cache.keys()) {
    if (key.startsWith(`${clinicId}:`)) {
      cache.delete(key)
      removed++
    }
  }
  return { cleared: clinicId, removed }
}

export function parseAnalyticsRange({ days = 30, from, to } = {}) {
  const end = to ? new Date(to) : new Date()
  end.setHours(23, 59, 59, 999)
  let start
  if (from) {
    start = new Date(from)
  } else {
    start = new Date(end)
    start.setDate(start.getDate() - Math.min(parseInt(days, 10) || 30, 365))
  }
  start.setHours(0, 0, 0, 0)
  return { start, end, days: Math.min(parseInt(days, 10) || 30, 365) }
}

function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function linearForecast(values) {
  if (!values.length) return 0
  if (values.length === 1) return values[0]
  const n = values.length
  let sumX = 0; let sumY = 0; let sumXY = 0; let sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += values[i]; sumXY += i * values[i]; sumX2 += i * i
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX || 1)
  const intercept = (sumY - slope * sumX) / n
  return Math.max(0, Math.round(intercept + slope * n))
}

function healthStatus(score) {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Needs Attention'
  return 'Critical'
}

async function loadCoreDataUncached(db, clinicId, range) {
  const { start, end } = range
  const startIso = isoDate(start)
  const endIso = isoDate(end)

  const prevStart = new Date(start)
  prevStart.setDate(prevStart.getDate() - (range.days || 30))
  const prevEnd = new Date(start)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStartIso = isoDate(prevStart)
  const prevEndIso = isoDate(prevEnd)

  const [
    invoices,
    prevInvoices,
    patients,
    appointments,
    visits,
    profiles,
    labCases,
  ] = await Promise.all([
    db.collection('invoices').find({
      clinic_id: clinicId,
      invoice_date: { $gte: startIso, $lte: endIso },
    }).toArray(),
    db.collection('invoices').find({
      clinic_id: clinicId,
      invoice_date: { $gte: prevStartIso, $lte: prevEndIso },
    }).toArray(),
    db.collection('patients').find({ clinic_id: clinicId, is_archived: { $ne: true } }).toArray(),
    db.collection('appointments').find({
      clinic_id: clinicId,
      appointment_date: { $gte: startIso, $lte: endIso },
    }).toArray(),
    db.collection('visits').find({
      clinic_id: clinicId,
      visit_date: { $gte: startIso, $lte: endIso },
    }).toArray(),
    db.collection('profiles').find({
      clinic_id: clinicId,
      $or: [
        { role: 'doctor' },
        { roles: 'doctor' },
        { roles: { $in: ['doctor'] } },
      ],
    }).toArray(),
    db.collection('lab_cases').find({ clinic_id: clinicId }).toArray(),
  ])

  return {
    invoices, prevInvoices, patients, appointments, visits, profiles, labCases,
    startIso, endIso, prevStartIso, prevEndIso,
  }
}

/**
 * Shared clinic analytics dataset. Dedupes concurrent loads and caches briefly
 * so getKpis / getBusinessHealth / getForecast don't each scan collections.
 */
async function loadCoreData(db, clinicId, range) {
  const key = coreDataKey(clinicId, range)
  const hit = coreDataCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data

  if (coreDataInflight.has(key)) return coreDataInflight.get(key)

  const promise = loadCoreDataUncached(db, clinicId, range)
    .then(data => {
      coreDataCache.set(key, { data, at: Date.now() })
      if (coreDataCache.size > 50) {
        const oldest = coreDataCache.keys().next().value
        coreDataCache.delete(oldest)
      }
      coreDataInflight.delete(key)
      return data
    })
    .catch(err => {
      coreDataInflight.delete(key)
      throw err
    })

  coreDataInflight.set(key, promise)
  return promise
}

/** Revenue intelligence */
export async function getRevenueAnalytics(db, clinicId, opts = {}) {
  const key = cacheKey(clinicId, 'revenue', opts)
  const cached = getCached(key)
  if (cached) return cached

  const range = parseAnalyticsRange(opts)
  const data = await loadCoreData(db, clinicId, range)
  const { invoices, prevInvoices } = data

  const paid = invoices.filter(i => i.payment_status === 'paid')
  const pending = invoices.filter(i => ['pending', 'partial'].includes(i.payment_status))
  const cancelled = invoices.filter(i => i.payment_status === 'cancelled')
  const refunded = invoices.filter(i => i.payment_status === 'refunded' || (i.amount_paid || 0) < 0)

  const totalRevenue = paid.reduce((s, i) => s + (i.total_amount || 0), 0)
  const prevRevenue = prevInvoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0)
  const pendingAmount = pending.reduce((s, i) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0)
  const collected = paid.reduce((s, i) => s + (i.amount_paid || i.total_amount || 0), 0)
  const billed = invoices.reduce((s, i) => s + (i.total_amount || 0), 0)
  const collectionEfficiency = billed ? Math.round((collected / billed) * 1000) / 10 : 100

  const byDoctor = {}
  const byPayment = {}
  const byTreatment = {}
  const byChair = {}
  for (const inv of paid) {
    const doc = inv.doctor_id || 'unassigned'
    byDoctor[doc] = (byDoctor[doc] || 0) + (inv.total_amount || 0)
    const mode = inv.payment_mode || 'cash'
    byPayment[mode] = (byPayment[mode] || 0) + (inv.total_amount || 0)
    const treatment = inv.treatment_name || inv.description || 'General'
    byTreatment[treatment] = (byTreatment[treatment] || 0) + (inv.total_amount || 0)
    if (inv.chair_id) byChair[inv.chair_id] = (byChair[inv.chair_id] || 0) + (inv.total_amount || 0)
  }

  const daily = {}
  const weekly = {}
  const monthly = {}
  for (const inv of paid) {
    const d = inv.invoice_date || isoDate(new Date(inv.created_at))
    daily[d] = (daily[d] || 0) + (inv.total_amount || 0)
    const dt = new Date(d + 'T12:00:00')
    const wk = `W${Math.ceil(dt.getDate() / 7)}-${dt.getMonth() + 1}`
    weekly[wk] = (weekly[wk] || 0) + (inv.total_amount || 0)
    const mo = dt.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    monthly[mo] = (monthly[mo] || 0) + (inv.total_amount || 0)
  }

  const trend = Object.entries(monthly).map(([month, revenue]) => ({ month, revenue }))
  const avgInvoice = paid.length ? Math.round(totalRevenue / paid.length) : 0

  const result = {
    total_revenue: totalRevenue,
    growth_pct: pctChange(totalRevenue, prevRevenue),
    prev_period_revenue: prevRevenue,
    collected,
    pending_collections: pendingAmount,
    cancelled_count: cancelled.length,
    refund_count: refunded.length,
    collection_efficiency_pct: collectionEfficiency,
    average_invoice: avgInvoice,
    revenue_by_doctor: byDoctor,
    revenue_by_treatment: byTreatment,
    revenue_by_chair: byChair,
    revenue_by_payment_method: byPayment,
    daily,
    weekly,
    monthly,
    trend,
    invoice_count: invoices.length,
    paid_count: paid.length,
  }
  setCache(key, result)
  return result
}

/** Patient intelligence */
export async function getPatientAnalytics(db, clinicId, opts = {}) {
  const key = cacheKey(clinicId, 'patients', opts)
  const cached = getCached(key)
  if (cached) return cached

  const range = parseAnalyticsRange(opts)
  const { start } = range
  const data = await loadCoreData(db, clinicId, range)
  const { patients, visits, invoices } = data
  const today = isoDate(new Date())
  const inactiveDays = 90

  const newPatients = patients.filter(p => p.created_at && new Date(p.created_at) >= start)
  const returning = new Set(visits.map(v => v.patient_id))
  const patientSpend = {}
  for (const inv of invoices.filter(i => i.payment_status === 'paid')) {
    patientSpend[inv.patient_id] = (patientSpend[inv.patient_id] || 0) + (inv.total_amount || 0)
  }

  const highValue = Object.entries(patientSpend)
    .map(([id, spend]) => ({ patient_id: id, name: patients.find(p => p.id === id)?.name, spend }))
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)

  const inactive = patients.filter(p => {
    const last = p.last_visit_date || p.updated_at
    if (!last) return true
    const days = Math.floor((Date.now() - new Date(last)) / 86400000)
    return days > inactiveDays
  })

  const pendingBalance = patients.filter(p => (p.outstanding_balance || 0) > 0)
  const followupsDue = patients.filter(p => p.next_followup_date && p.next_followup_date <= today)
  const pendingTreatment = patients.filter(p => {
    const pv = visits.filter(v => v.patient_id === p.id)
    return pv.some(v => v.treatment_plan && !v.treatment_done)
  })

  const totalActive = patients.length
  const retained = patients.filter(p => (p.total_visits || 0) >= 2).length
  const retentionPct = totalActive ? Math.round((retained / totalActive) * 1000) / 10 : 0
  const avgLtv = totalActive
    ? Math.round(Object.values(patientSpend).reduce((s, v) => s + v, 0) / totalActive)
    : 0
  const avgTreatmentValue = visits.length
    ? Math.round(invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (i.total_amount || 0), 0) / Math.max(visits.length, 1))
    : 0

  const result = {
    total_patients: totalActive,
    new_patients: newPatients.length,
    returning_patients: returning.size,
    inactive_patients: inactive.length,
    lost_patients: inactive.filter(p => (p.total_visits || 0) >= 1).length,
    high_value_patients: highValue,
    pending_treatment: pendingTreatment.length,
    pending_balance: pendingBalance.length,
    followups_due: followupsDue.length,
    retention_pct: retentionPct,
    lifetime_value_avg: avgLtv,
    average_treatment_value: avgTreatmentValue,
    visit_frequency_avg: totalActive ? Math.round((visits.length / totalActive) * 10) / 10 : 0,
  }
  setCache(key, result)
  return result
}

/** Appointment intelligence */
export async function getAppointmentAnalytics(db, clinicId, opts = {}) {
  const key = cacheKey(clinicId, 'appointments', opts)
  const cached = getCached(key)
  if (cached) return cached

  const range = parseAnalyticsRange(opts)
  const today = isoDate(new Date())
  const [data, flow] = await Promise.all([
    loadCoreData(db, clinicId, range),
    computeFlowMetrics(db, clinicId, today),
  ])
  const { appointments } = data

  const total = appointments.length
  const cancelled = appointments.filter(a => a.status === 'cancelled').length
  const noShow = appointments.filter(a => a.status === 'no_show').length
  const completed = appointments.filter(a => a.status === 'completed').length

  const hourCounts = {}
  const weekdayCounts = {}
  for (const a of appointments) {
    const h = (a.appointment_time || '09:00').slice(0, 2)
    hourCounts[h] = (hourCounts[h] || 0) + 1
    const wd = new Date(a.appointment_date + 'T12:00:00').getDay()
    weekdayCounts[wd] = (weekdayCounts[wd] || 0) + 1
  }
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]
  const peakWeekday = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0]
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const result = {
    total_appointments: total,
    cancellation_rate_pct: total ? Math.round((cancelled / total) * 1000) / 10 : 0,
    no_show_rate_pct: total ? Math.round((noShow / total) * 1000) / 10 : 0,
    completion_rate_pct: total ? Math.round((completed / total) * 1000) / 10 : 0,
    peak_hour: peakHour ? { hour: peakHour[0], count: peakHour[1] } : null,
    peak_weekday: peakWeekday ? { day: weekdayNames[peakWeekday[0]], count: peakWeekday[1] } : null,
    doctor_utilization_pct: flow.doctor_utilization_pct ?? flow.chair_utilization_pct ?? null,
    chair_utilization_pct: flow.chair_utilization_pct,
    average_consultation_minutes: flow.average_treatment_minutes,
    average_wait_minutes: flow.average_wait_minutes,
    upcoming_overload: flow.queue_health === 'critical',
    empty_slots_estimate: Math.max(0, 8 - (flow.appointments_today || 0)),
    flow,
  }
  setCache(key, result)
  return result
}

/** Doctor performance */
export async function getDoctorAnalytics(db, clinicId, opts = {}) {
  const key = cacheKey(clinicId, 'doctors', opts)
  const cached = getCached(key)
  if (cached) return cached

  const range = parseAnalyticsRange(opts)
  const data = await loadCoreData(db, clinicId, range)
  const { profiles, appointments, invoices, visits, labCases } = data

  const doctors = profiles.map(doc => {
    const docAppts = appointments.filter(a => a.doctor_id === doc.id)
    const docInv = invoices.filter(i => i.doctor_id === doc.id && i.payment_status === 'paid')
    const docVisits = visits.filter(v => v.doctor_id === doc.id)
    const docLabs = labCases.filter(c => c.created_by === doc.id || c.doctor_id === doc.id)
    const revenue = docInv.reduce((s, i) => s + (i.total_amount || 0), 0)
    const patients = new Set(docAppts.map(a => a.patient_id).filter(Boolean)).size
    const completed = docAppts.filter(a => a.status === 'completed').length
    const prescriptions = docVisits.reduce((s, v) => s + (v.prescriptions?.length || 0), 0)

    const durations = docAppts
      .filter(a => a.treatment_started_at && a.completed_at)
      .map(a => Math.round((new Date(a.completed_at) - new Date(a.treatment_started_at)) / 60000))
    const avgTreatment = durations.length
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null

    const efficiency = docAppts.length
      ? Math.round((completed / docAppts.length) * 100)
      : 0
    const productivity = Math.min(100, Math.round((revenue / 100000) * 100))

    return {
      doctor_id: doc.id,
      name: doc.full_name || doc.name || 'Doctor',
      appointments: docAppts.length,
      revenue,
      patients_handled: patients,
      average_treatment_minutes: avgTreatment,
      prescriptions,
      lab_cases: docLabs.length,
      followups: docVisits.filter(v => v.next_visit_recommended).length,
      collections: docInv.reduce((s, i) => s + (i.amount_paid || i.total_amount || 0), 0),
      efficiency_score: efficiency,
      productivity_score: productivity,
      completed,
    }
  }).sort((a, b) => b.revenue - a.revenue)

  setCache(key, { doctors, leaderboard: doctors.slice(0, 5) })
  return { doctors, leaderboard: doctors.slice(0, 5) }
}

/** Treatment intelligence */
export async function getTreatmentAnalytics(db, clinicId, opts = {}) {
  const key = cacheKey(clinicId, 'treatments', opts)
  const cached = getCached(key)
  if (cached) return cached

  const range = parseAnalyticsRange(opts)
  const data = await loadCoreData(db, clinicId, range)
  const { visits, invoices } = data

  const freq = {}
  const revenue = {}
  const completed = {}
  const planned = {}

  for (const v of visits) {
    const t = v.treatment_done || v.treatment_plan
    if (!t) continue
    const name = t.split(/[,;]/)[0].trim().slice(0, 80)
    freq[name] = (freq[name] || 0) + 1
    if (v.treatment_done) completed[name] = (completed[name] || 0) + 1
    if (v.treatment_plan && !v.treatment_done) planned[name] = (planned[name] || 0) + 1
  }
  for (const inv of invoices.filter(i => i.payment_status === 'paid')) {
    const t = inv.treatment_name || inv.description || 'General'
    revenue[t] = (revenue[t] || 0) + (inv.total_amount || 0)
  }

  const topTreatments = Object.entries(freq).map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count).slice(0, 10)
  const topRevenue = Object.entries(revenue).map(([name, rev]) => ({ name, revenue: rev }))
    .sort((a, b) => b.revenue - a.revenue).slice(0, 10)

  const completionRates = Object.keys(freq).map(name => ({
    name,
    completion_pct: freq[name] ? Math.round(((completed[name] || 0) / freq[name]) * 100) : 0,
  })).sort((a, b) => b.completion_pct - a.completion_pct).slice(0, 10)

  const result = {
    top_treatments: topTreatments,
    highest_revenue_treatments: topRevenue,
    completion_rates: completionRates,
    treatment_frequency: freq,
    treatment_trends: topTreatments,
  }
  setCache(key, result)
  return result
}

/** Inventory — delegates to Inventory Workflow Engine */
export async function getInventoryAnalytics(db, clinicId) {
  const key = cacheKey(clinicId, 'inventory', {})
  const cached = getCached(key)
  if (cached) return cached
  // Lite path is sufficient for BI cards and avoids vendor/movement-meta N+1 work
  const metrics = await computeInventoryMetricsLite(db, clinicId)
  const result = {
    ...metrics,
    waste_pct: metrics.total_value
      ? Math.round((metrics.expiry_loss / metrics.total_value) * 1000) / 10
      : 0,
    material_cost_per_consumption: metrics.monthly_consumption
      ? Math.round(metrics.monthly_spend / metrics.monthly_consumption)
      : 0,
  }
  setCache(key, result)
  return result
}

/** Lab — delegates to Lab Workflow Engine */
export async function getLabAnalytics(db, clinicId) {
  const key = cacheKey(clinicId, 'lab', {})
  const cached = getCached(key)
  if (cached) return cached
  const metrics = await computeLabMetricsLite(db, clinicId)
  const efficiency = metrics.total_cases
    ? Math.round(((metrics.total_cases - metrics.delayed_cases) / metrics.total_cases) * 100)
    : 100
  const vendorRanking = Object.entries(metrics.vendor_stats || {})
    .map(([id, s]) => ({ vendor_id: id, ...s, score: s.total ? Math.round((s.completed / s.total) * 100) : 0 }))
    .sort((a, b) => b.score - a.score)
  const result = {
    ...metrics,
    delayed_pct: metrics.delay_percentage,
    vendor_ranking: vendorRanking,
    lab_efficiency_score: efficiency,
    completed_today: metrics.completed_this_week, // approx — engine uses week
  }
  setCache(key, result)
  return result
}

/** Trend-based forecast */
export async function getForecastAnalytics(db, clinicId, opts = {}) {
  const revenue = await getRevenueAnalytics(db, clinicId, { days: 90, ...opts })
  const patients = await getPatientAnalytics(db, clinicId, { days: 90, ...opts })
  const appointments = await getAppointmentAnalytics(db, clinicId, { days: 90, ...opts })
  const inventory = await getInventoryAnalytics(db, clinicId)
  const lab = await getLabAnalytics(db, clinicId)

  const monthlyValues = Object.values(revenue.monthly || {})
  const revenueForecast = linearForecast(monthlyValues)

  return {
    next_month_revenue: revenueForecast,
    expected_appointments: linearForecast([appointments.total_appointments / 3, appointments.total_appointments / 2, appointments.total_appointments]),
    expected_patients: linearForecast([patients.new_patients / 3, patients.new_patients / 2, patients.new_patients]),
    expected_inventory_spend: linearForecast([inventory.monthly_spend / 2, inventory.monthly_spend]),
    expected_lab_workload: lab.open_cases + Math.round(lab.open_cases * 0.1),
    expected_collections: Math.round(revenueForecast * (revenue.collection_efficiency_pct / 100)),
    method: 'linear_trend',
  }
}

/** Business health score (0–100) */
export async function getBusinessHealth(db, clinicId, opts = {}) {
  const key = cacheKey(clinicId, 'health', opts)
  const cached = getCached(key)
  if (cached) return cached

  const [revenue, patients, appointments, inventory, lab, doctors] = await Promise.all([
    getRevenueAnalytics(db, clinicId, opts),
    getPatientAnalytics(db, clinicId, opts),
    getAppointmentAnalytics(db, clinicId, opts),
    getInventoryAnalytics(db, clinicId),
    getLabAnalytics(db, clinicId),
    getDoctorAnalytics(db, clinicId, opts),
  ])

  const factors = {
    attendance: Math.max(0, 100 - appointments.no_show_rate_pct * 2 - appointments.cancellation_rate_pct),
    collections: revenue.collection_efficiency_pct,
    revenue_trend: Math.min(100, 50 + revenue.growth_pct),
    patient_retention: patients.retention_pct,
    inventory_health: inventory.inventory_health_pct || 80,
    lab_turnaround: lab.lab_efficiency_score || 80,
    treatment_completion: appointments.completion_rate_pct,
    doctor_productivity: doctors.doctors.length
      ? Math.round(doctors.doctors.reduce((s, d) => s + d.productivity_score, 0) / doctors.doctors.length)
      : 70,
    followup_completion: patients.followups_due
      ? Math.max(0, 100 - Math.min(50, patients.followups_due))
      : 95,
    activity_consistency: 85,
  }

  const weights = {
    attendance: 12, collections: 14, revenue_trend: 12, patient_retention: 10,
    inventory_health: 8, lab_turnaround: 8, treatment_completion: 12,
    doctor_productivity: 10, followup_completion: 8, activity_consistency: 6,
  }

  let score = 0
  let weightSum = 0
  for (const [k, w] of Object.entries(weights)) {
    score += Math.min(100, Math.max(0, factors[k] || 0)) * w
    weightSum += w
  }
  score = Math.round(score / weightSum)

  const result = {
    score,
    status: healthStatus(score),
    factors,
    breakdown: Object.entries(factors).map(([key, value]) => ({ key, value, weight: weights[key] })),
  }
  setCache(key, result)
  return result
}

/** Rule-based smart insights (no AI) */
export function generateSmartInsights({ revenue, patients, appointments, inventory, lab, doctors, health }) {
  const insights = []

  if (revenue.growth_pct > 5) {
    insights.push(`Revenue increased ${revenue.growth_pct}% compared to the previous period.`)
  } else if (revenue.growth_pct < -5) {
    insights.push(`Revenue declined ${Math.abs(revenue.growth_pct)}% compared to the previous period.`)
  }

  const topDoc = doctors.leaderboard?.[0]
  if (topDoc && revenue.total_revenue) {
    const pct = Math.round((topDoc.revenue / revenue.total_revenue) * 100)
    if (pct >= 20) insights.push(`${topDoc.name} generated ${pct}% of clinic revenue.`)
  }

  if (appointments.peak_weekday) {
    insights.push(`${appointments.peak_weekday.day} is your busiest day.`)
  }

  if (inventory.waste_pct > 0 && inventory.waste_pct < 20) {
    insights.push(`Inventory waste is at ${inventory.waste_pct}% — monitor expiry closely.`)
  }

  const topTreatment = revenue.revenue_by_treatment
    ? Object.entries(revenue.revenue_by_treatment).sort((a, b) => b[1] - a[1])[0]
    : null
  if (topTreatment) {
    insights.push(`${topTreatment[0]} generates the highest revenue.`)
  }

  const worstVendor = lab.vendor_ranking?.find(v => v.delayed > 0)
  if (worstVendor) {
    insights.push(`Lab vendor with most delays has ${worstVendor.delayed} delayed cases.`)
  }

  if (patients.retention_pct >= 60) {
    insights.push('Patient retention is healthy this period.')
  } else if (patients.retention_pct < 40) {
    insights.push('Patient retention needs attention — focus on follow-ups.')
  }

  if (revenue.pending_collections > revenue.total_revenue * 0.2) {
    insights.push(`₹${Math.round(revenue.pending_collections).toLocaleString('en-IN')} in pending collections.`)
  }

  if (health.score >= 85) insights.push(`Business health is ${health.status} at ${health.score}/100.`)

  return insights.slice(0, 10)
}

/** All KPIs in one call */
export async function getKpis(db, clinicId, opts = {}) {
  const key = cacheKey(clinicId, 'kpis', opts)
  const cached = getCached(key)
  if (cached) return cached

  const [revenue, patients, appointments, inventory, lab, doctors, treatments, health, forecast] = await Promise.all([
    getRevenueAnalytics(db, clinicId, opts),
    getPatientAnalytics(db, clinicId, opts),
    getAppointmentAnalytics(db, clinicId, opts),
    getInventoryAnalytics(db, clinicId),
    getLabAnalytics(db, clinicId),
    getDoctorAnalytics(db, clinicId, opts),
    getTreatmentAnalytics(db, clinicId, opts),
    getBusinessHealth(db, clinicId, opts),
    getForecastAnalytics(db, clinicId, opts),
  ])

  const insights = generateSmartInsights({ revenue, patients, appointments, inventory, lab, doctors, health })

  const result = {
    revenue, patients, appointments, inventory, lab, doctors, treatments, health, forecast, insights,
  }
  setCache(key, result)
  return result
}

/** Executive dashboard payload */
export async function getExecutiveDashboard(db, clinicId, opts = {}) {
  return getKpis(db, clinicId, opts)
}

/** Communication analytics (Sprint 17) */
export async function getCommunicationAnalytics(db, clinicId, opts = {}) {
  const range = parseAnalyticsRange(opts)
  const key = cacheKey(clinicId, 'communication', opts)
  const cached = getCached(key)
  if (cached) return cached

  const metrics = await computeCommunicationMetrics(db, clinicId, range)
  setCache(key, metrics)
  return metrics
}

/** AI analytics (Sprint 18) */
export async function getAIAnalytics(db, clinicId, opts = {}) {
  const range = parseAnalyticsRange(opts)
  const key = cacheKey(clinicId, 'ai', opts)
  const cached = getCached(key)
  if (cached) return cached

  const metrics = await computeAIMetrics(db, clinicId, range)
  setCache(key, metrics)
  return metrics
}

/** Platform-wide BI (Platform Admin) */
export async function getPlatformBusinessAnalytics(db) {
  const key = 'platform:bi'
  const cached = getCached(key)
  if (cached) return cached

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

  const [clinics, subscriptions, invoicesAgg, patientsAgg] = await Promise.all([
    db.collection('clinics').find({}).toArray(),
    db.collection('subscriptions').find({}).toArray(),
    db.collection('invoices').aggregate([
      { $match: { payment_status: 'paid', invoice_date: { $gte: isoDate(monthStart) } } },
      { $group: { _id: '$clinic_id', revenue: { $sum: '$total_amount' } } },
    ]).toArray(),
    db.collection('patients').aggregate([
      { $match: { created_at: { $gte: monthStart } } },
      { $group: { _id: '$clinic_id', count: { $sum: 1 } } },
    ]).toArray(),
  ])

  const prevInvoices = await db.collection('invoices').aggregate([
    { $match: { payment_status: 'paid', invoice_date: { $gte: isoDate(prevMonthStart), $lte: isoDate(prevMonthEnd) } } },
    { $group: { _id: '$clinic_id', revenue: { $sum: '$total_amount' } } },
  ]).toArray()

  const revMap = Object.fromEntries(invoicesAgg.map(r => [r._id, r.revenue]))
  const prevRevMap = Object.fromEntries(prevInvoices.map(r => [r._id, r.revenue]))
  const patientMap = Object.fromEntries(patientsAgg.map(r => [r._id, r.count]))

  const clinicScores = clinics.map(c => {
    const rev = revMap[c.id] || 0
    const prev = prevRevMap[c.id] || 0
    const growth = pctChange(rev, prev)
    return {
      clinic_id: c.id,
      name: c.name,
      revenue: rev,
      growth_pct: growth,
      new_patients: patientMap[c.id] || 0,
      subscription_status: subscriptions.find(s => s.clinic_id === c.id)?.subscription_status || c.subscription_status,
    }
  })

  const topClinics = [...clinicScores].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  const fastestGrowing = [...clinicScores].filter(c => c.growth_pct > 0).sort((a, b) => b.growth_pct - a.growth_pct).slice(0, 5)
  const declining = [...clinicScores].filter(c => c.growth_pct < -10).sort((a, b) => a.growth_pct - b.growth_pct).slice(0, 5)

  const mrr = subscriptions
    .filter(s => s.subscription_status === 'active')
    .reduce((s, sub) => s + (sub.amount || sub.plan_amount || 0), 0)
  const activeTrials = subscriptions.filter(s => s.subscription_status === 'trial').length
  const converted = subscriptions.filter(s => s.converted_from_trial).length
  const churned = subscriptions.filter(s => s.subscription_status === 'cancelled').length

  const manualPayments = await db.collection('clinic_manual_payments').aggregate([
    { $match: { recorded_at: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]).toArray()

  const result = {
    top_clinics: topClinics,
    fastest_growing: fastestGrowing,
    declining_clinics: declining,
    mrr,
    arr: mrr * 12,
    trial_conversion_pct: activeTrials + converted
      ? Math.round((converted / (activeTrials + converted)) * 100)
      : 0,
    churn_count: churned,
    average_clinic_revenue: clinicScores.length
      ? Math.round(clinicScores.reduce((s, c) => s + c.revenue, 0) / clinicScores.length)
      : 0,
    platform_revenue_month: manualPayments[0]?.total || 0,
    total_clinics: clinics.length,
    active_subscriptions: subscriptions.filter(s => s.subscription_status === 'active').length,
    revenue_leaderboard: topClinics,
  }
  setCache(key, result)
  return result
}

/** CSV export helper */
export function toCsv(rows, columns) {
  const header = columns.join(',')
  const lines = rows.map(row =>
    columns.map(c => {
      const v = row[c]
      if (v == null) return ''
      const s = String(v).replace(/"/g, '""')
      return s.includes(',') ? `"${s}"` : s
    }).join(',')
  )
  return [header, ...lines].join('\n')
}

export function clearAnalyticsCache(clinicId) {
  clearCoreDataCache(clinicId)
  if (!clinicId) { cache.clear(); return }
  for (const k of cache.keys()) {
    if (k.startsWith(`${clinicId}:`)) cache.delete(k)
  }
}

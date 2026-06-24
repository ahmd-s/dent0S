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
const todayIso = () => new Date().toISOString().slice(0,10)
const yIso = () => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10) }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function GET(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    
    const { profile, clinic, db } = user
    const cid = profile.clinic_id
    const today = todayIso()
    const yest = yIso()
    
    // OPTIMIZED: Combine multiple queries into fewer batched operations
    // Reduced from 12+ separate calls to 5 main batched operations
    const [todayAppts, countStats, revenueStats, followupStats, labCaseStats] = await Promise.all([
      // Batch 1: Get today's appointments with patient/doctor lookup using aggregation
      // This replaces the original 4 separate queries (appointments + patients + doctors + visits)
      db.collection('appointments').aggregate([
        { $match: { clinic_id: cid, appointment_date: today } },
        { $sort: { appointment_time: 1 } },
        { $lookup: { 
            from: 'patients', 
            as: 'patient', 
            let: { patient_id: '$patient_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$id', '$$patient_id'] } } },
              { $project: { name: 1, phone: 1 } }
            ]
        }},
        { $lookup: {
            from: 'profiles',
            as: 'doctor',
            let: { doctor_id: '$doctor_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$id', '$$doctor_id'] } } },
              { $project: { full_name: 1 } }
            ]
        }},
        { $lookup: {
            from: 'visits',
            as: 'visit',
            let: { appointment_id: '$id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$appointment_id', '$$appointment_id'] } } },
              { $project: { id: 1 } }
            ]
        }},
        { $addFields: {
            patient_name: { $ifNull: [{ $arrayElemAt: ['$patient.name', 0] }, '$patient_name_temp'] },
            patient_phone: { $ifNull: [{ $arrayElemAt: ['$patient.phone', 0] }, '$patient_phone_temp'] },
            doctor_name: { $arrayElemAt: ['$doctor.full_name', 0] },
            visit_id: { $arrayElemAt: ['$visit.id', 0] }
        }},
        { $project: { patient: 0, doctor: 0, visit: 0 } }
      ]).toArray(),
      
      // Batch 2: Combine patient count stats into single aggregation
      // This replaces the 2 separate countDocuments calls
      db.collection('appointments').aggregate([
        { $match: { 
            $or: [
              { clinic_id: cid, appointment_date: today },
              { clinic_id: cid, appointment_date: yest }
            ]
        }},
        { $group: {
            _id: '$appointment_date',
            completed_count: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }}
      ]).toArray(),
      
      // Batch 3: Combine revenue aggregations using $facet
      // This replaces the 2 separate aggregate calls
      db.collection('invoices').aggregate([
        { $match: { clinic_id: cid, invoice_date: today } },
        { $facet: {
            paid: [
              { $match: { payment_status: 'paid' } },
              { $group: { _id: null, sum: { $sum: '$total_amount' } } }
            ],
            pending: [
              { $match: { payment_status: { $in: ['pending', 'partial'] } } },
              { $group: { _id: null, sum: { $sum: '$total_amount' } } }
            ]
        }}
      ]).toArray(),
      
      // Batch 4: Combine followup data and count using $facet
      // This replaces the 2 separate queries (find + countDocuments)
      db.collection('patients').aggregate([
        { $match: { clinic_id: cid, is_archived: { $ne: true }, next_followup_date: { $ne: null, $lte: today } } },
        { $facet: {
            data: [{ $limit: 5 }],
            count: [{ $count: 'total' }]
        }}
      ]).toArray(),
      
      // Batch 5: Combine lab case counts using $facet
      // This replaces the 2 separate countDocuments calls
      db.collection('lab_cases').aggregate([
        { $match: { clinic_id: cid, status: { $in: ['pending', 'sent', 'in_progress'] } } },
        { $facet: {
            active: [{ $count: 'total' }],
            overdue: [
              { $match: { expected_delivery_date: { $ne: null, $lt: today } } },
              { $count: 'total' }
            ]
        }}
      ]).toArray()
    ])
    
    // Extract results from aggregations
    const countStatsMap = Object.fromEntries(countStats.map(s => [s._id, s.completed_count]))
    const doneToday = countStatsMap[today] || 0
    const doneYest = countStatsMap[yest] || 0
    
    const revenueResults = revenueStats[0] || {}
    const revenue_today = revenueResults.paid?.[0]?.sum || 0
    const pending_today = revenueResults.pending?.[0]?.sum || 0
    
    const followupResults = followupStats[0] || {}
    const followups = followupResults.data || []
    const fcount = followupResults.count?.[0]?.total || 0
    
    const labResults = labCaseStats[0] || {}
    const activeLabCases = labResults.active?.[0]?.total || 0
    const overdueLabCases = labResults.overdue?.[0]?.total || 0
    
    return json({
      clinic_name: clinic?.name,
      patients_seen_today: doneToday, 
      patients_seen_yesterday: doneYest,
      revenue_today, 
      pending_today,
      followups_due_count: fcount,
      active_lab_cases: activeLabCases, 
      overdue_lab_cases: overdueLabCases,
      today_queue: todayAppts.map(a => clean(a)),
      followups: followups.map(p => ({ ...clean(p), last_visit_reason: '' })),
    })
    
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return err('Internal server error', 500)
  }
}
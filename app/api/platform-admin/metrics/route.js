import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { getPlatformBusinessAnalytics } from '@/lib/analytics-engine'
import { getPlatformCommunicationAnalytics } from '@/lib/communication-engine'
import { getPlatformAIAnalytics } from '@/lib/ai-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const { db } = ctx

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      clinicStats,
      profileCounts,
      patientCount,
      visitsToday,
      appointmentsToday,
      aiUsageToday,
      documentCount,
      revenueMonth,
      paymentCounts,
      expiringTrials,
      expiringGrace,
      platformSettings,
      flowEventsToday,
      labEventsToday,
      inventoryEventsToday,
      inventoryValueAgg,
    ] = await Promise.all([
      // Clinic breakdown by status
      db.collection('clinics').aggregate([
        {
          $lookup: {
            from: 'subscriptions',
            localField: 'id',
            foreignField: 'clinic_id',
            as: 'sub',
          },
        },
        { $unwind: { path: '$sub', preserveNullAndEmpty: true } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: {
              $sum: {
                $cond: [{ $eq: ['$subscription_status', 'active'] }, 1, 0],
              },
            },
            blocked: {
              $sum: {
                $cond: [{ $eq: ['$subscription_status', 'blocked'] }, 1, 0],
              },
            },
            trial: {
              $sum: {
                $cond: [{ $eq: ['$sub.subscription_status', 'trial'] }, 1, 0],
              },
            },
            grace: {
              $sum: {
                $cond: [{ $eq: ['$sub.subscription_status', 'halted'] }, 1, 0],
              },
            },
            comped: {
              $sum: {
                $cond: [{ $eq: ['$sub.platform_status', 'comped'] }, 1, 0],
              },
            },
          },
        },
      ]).toArray(),

      // Staff counts by role
      db.collection('profiles').aggregate([
        { $match: { clinic_id: { $ne: null }, deleted_at: { $exists: false }, is_platform_admin: { $ne: true } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]).toArray(),

      // Total patients
      db.collection('patients').countDocuments({ deleted_at: { $exists: false } }),

      // Visits today
      db.collection('visits').countDocuments({ created_at: { $gte: todayStart } }),

      // Appointments today
      db.collection('appointments').countDocuments({
        $or: [
          { appointment_date: { $gte: todayStart } },
          { start_time: { $gte: todayStart } },
        ],
      }),

      // AI usage today — from audit logs of AI actions
      db.collection('audit_logs').countDocuments({ action: 'ai_suggestion', at: { $gte: todayStart } })
        .catch(() => 0),

      // Documents stored
      db.collection('documents').countDocuments({ deleted_at: { $exists: false } }).catch(() => 0),

      // Revenue this month from manual payments
      db.collection('clinic_manual_payments').aggregate([
        { $match: { recorded_at: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]).toArray(),

      // Payment status counts from subscriptions
      db.collection('subscriptions').aggregate([
        {
          $group: {
            _id: '$subscription_status',
            count: { $sum: 1 },
          },
        },
      ]).toArray(),

      // Trials expiring in ≤7 days
      db.collection('clinics').countDocuments({
        trial_ends_at: {
          $gte: now,
          $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
        subscription_status: 'active',
      }),

      // Grace expiring in ≤7 days
      db.collection('subscriptions').countDocuments({
        subscription_status: 'halted',
        grace_period_end: {
          $gte: now,
          $lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      }),

      // Platform settings for infra health
      db.collection('platform_settings').findOne({ _type: 'global' }),

      // Sprint 13 — flow events today for platform-wide queue health
      db.collection('activity_events').aggregate([
        { $match: { module: 'appointments', created_at: { $gte: todayStart } } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
      ]).toArray(),

      db.collection('activity_events').aggregate([
        { $match: { module: 'lab', created_at: { $gte: todayStart } } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
      ]).toArray(),

      db.collection('activity_events').aggregate([
        { $match: { module: 'inventory', created_at: { $gte: todayStart } } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
      ]).toArray(),

      db.collection('inventory_items').aggregate([
        { $group: { _id: '$clinic_id', value: { $sum: { $multiply: [{ $ifNull: ['$current_stock', 0] }, { $ifNull: ['$purchase_price', 0] }] } } } },
        { $group: { _id: null, total_value: { $sum: '$value' }, clinics: { $sum: 1 } } },
      ]).toArray(),
    ])

    const platformBi = await getPlatformBusinessAnalytics(db)
    const platformCommunication = await getPlatformCommunicationAnalytics(db)
    const platformAI = await getPlatformAIAnalytics(db)

    // Mongo health via ping
    let mongoHealthy = true
    let mongoLatencyMs = null
    try {
      const t0 = Date.now()
      await db.command({ ping: 1 })
      mongoLatencyMs = Date.now() - t0
    } catch {
      mongoHealthy = false
    }

    const clinicRow = clinicStats[0] || {}
    const roleMap = Object.fromEntries(profileCounts.map(r => [r._id, r.count]))
    const paymentMap = Object.fromEntries(paymentCounts.map(r => [r._id, r.count]))
    const flowMap = Object.fromEntries((flowEventsToday || []).map(r => [r._id, r.count]))
    const labMap = Object.fromEntries((labEventsToday || []).map(r => [r._id, r.count]))
    const inventoryMap = Object.fromEntries((inventoryEventsToday || []).map(r => [r._id, r.count]))
    const avgWaitEvents = flowMap.DOCTOR_READY || flowMap.APPOINTMENT_CALLED || 0
    const platformInventoryValue = inventoryValueAgg?.[0]?.total_value || 0

    return json({
      platform: {
        total: clinicRow.total || 0,
        active: clinicRow.active || 0,
        blocked: clinicRow.blocked || 0,
        trial: clinicRow.trial || 0,
        grace: clinicRow.grace || 0,
        comped: clinicRow.comped || 0,
      },
      usage: {
        doctors: roleMap.doctor || 0,
        receptionists: roleMap.receptionist || 0,
        admins: roleMap.admin || 0,
        patients: patientCount,
        visits_today: visitsToday,
        appointments_today: appointmentsToday,
        ai_requests_today: aiUsageToday,
        documents_stored: documentCount,
      },
      revenue: {
        monthly_manual_revenue: revenueMonth[0]?.total || 0,
        failed_payments: paymentMap.halted || 0,
        expiring_trials: expiringTrials,
        expiring_grace: expiringGrace,
        active_subscriptions: paymentMap.active || 0,
      },
      infrastructure: {
        mongo_healthy: mongoHealthy,
        mongo_latency_ms: mongoLatencyMs,
        last_cron_run: platformSettings?.last_cron_run || null,
        email_configured: !!process.env.RESEND_API_KEY || !!process.env.SMTP_HOST,
        whatsapp_configured: !!process.env.WHATSAPP_API_KEY,
        razorpay_configured: !!process.env.RAZORPAY_KEY_ID,
        server_time: now.toISOString(),
        environment: process.env.NODE_ENV || 'development',
      },
      flow: {
        average_waiting_events_today: avgWaitEvents,
        chair_assignments_today: flowMap.CHAIR_ASSIGNED || 0,
        treatments_started_today: flowMap.TREATMENT_STARTED || 0,
        visits_completed_today: flowMap.VISIT_COMPLETED || flowMap.APPOINTMENT_COMPLETED || 0,
        daily_throughput: flowMap.VISIT_COMPLETED || flowMap.APPOINTMENT_COMPLETED || visitsToday,
        queue_health: avgWaitEvents > 50 ? 'critical' : avgWaitEvents > 20 ? 'moderate' : 'good',
        appointments_today: appointmentsToday,
      },
      lab: {
        cases_created_today: labMap.LAB_CREATED || 0,
        cases_sent_today: labMap.LAB_SENT || 0,
        cases_delivered_today: labMap.LAB_DELIVERED || 0,
        cases_completed_today: labMap.LAB_COMPLETED || 0,
        stl_uploads_today: (labMap.STL_UPLOADED || 0) + (labMap.STL_REPLACED || 0),
        delayed_events_today: labMap.DELIVERY_DELAYED || 0,
        average_turnaround_events: labMap.LAB_DELIVERED || 0,
        top_vendors_activity: labMap.VENDOR_CHANGED || 0,
        case_volume_today: labMap.LAB_CREATED || 0,
      },
      inventory: {
        platform_inventory_value: platformInventoryValue,
        stock_received_today: inventoryMap.STOCK_RECEIVED || inventoryMap.INVENTORY_STOCK_IN || 0,
        stock_consumed_today: inventoryMap.STOCK_CONSUMED || inventoryMap.INVENTORY_CONSUMED || 0,
        low_stock_alerts_today: inventoryMap.LOW_STOCK || 0,
        critical_stock_alerts_today: inventoryMap.CRITICAL_STOCK || 0,
        purchase_requests_today: inventoryMap.PURCHASE_CREATED || 0,
        purchases_received_today: inventoryMap.PURCHASE_RECEIVED || 0,
        expired_items_today: inventoryMap.ITEM_EXPIRED || 0,
        most_used_events: inventoryMap.STOCK_CONSUMED || 0,
      },
      business: platformBi,
      communication: platformCommunication,
      ai: platformAI,
    })
  } catch (e) {
    console.error('Metrics error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

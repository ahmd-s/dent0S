/**
 * Super Admin Razorpay account snapshot — server-only. Never import from client files.
 */

import Razorpay from 'razorpay'

const DASHBOARD_URL = 'https://dashboard.razorpay.com/app/payments'

function asList(result) {
  if (!result) return []
  if (Array.isArray(result.items)) return result.items
  if (Array.isArray(result)) return result
  return []
}

function maskKey(keyId) {
  if (!keyId) return null
  if (keyId.length <= 10) return `${keyId.slice(0, 4)}…`
  return `${keyId.slice(0, 8)}…${keyId.slice(-4)}`
}

function summarizePayments(items) {
  const now = Date.now()
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  let capturedMonthPaise = 0
  let capturedCount = 0
  let failedCount = 0
  let authorizedCount = 0
  for (const p of items) {
    if (p.status === 'captured') {
      capturedCount += 1
      const created = (p.created_at || 0) * 1000
      if (created >= monthStart && created <= now) capturedMonthPaise += Number(p.amount) || 0
    } else if (p.status === 'failed') failedCount += 1
    else if (p.status === 'authorized') authorizedCount += 1
  }
  return { capturedMonthPaise, capturedCount, failedCount, authorizedCount }
}

function mapPayment(p) {
  return {
    id: p.id,
    amount: Number(p.amount) || 0,
    currency: p.currency || 'INR',
    status: p.status || 'unknown',
    method: p.method || null,
    email: p.email || null,
    contact: p.contact || null,
    created_at: p.created_at ? new Date(p.created_at * 1000).toISOString() : null,
    clinic_id: p.notes?.clinic_id || null,
  }
}

function mapSubscription(s) {
  return {
    id: s.id,
    plan_id: s.plan_id || null,
    status: s.status || 'unknown',
    quantity: s.quantity || 1,
    total_count: s.total_count || null,
    paid_count: s.paid_count || 0,
    charge_at: s.charge_at ? new Date(s.charge_at * 1000).toISOString() : null,
    current_end: s.current_end ? new Date(s.current_end * 1000).toISOString() : null,
    clinic_id: s.notes?.clinic_id || null,
  }
}

export async function collectRazorpayAccount(db) {
  const keyId = process.env.RAZORPAY_KEY_ID || ''
  const keySecret = process.env.RAZORPAY_KEY_SECRET || ''
  const webhook = !!process.env.RAZORPAY_WEBHOOK_SECRET

  if (!keyId || !keySecret) {
    return {
      configured: false,
      webhook_configured: webhook,
      key_id_masked: null,
      mode: null,
      dashboard_url: DASHBOARD_URL,
      kpis: {
        captured_this_month: 0,
        captured_count: 0,
        failed_count: 0,
        authorized_count: 0,
        razorpay_subscriptions: 0,
        linked_clinics: 0,
      },
      payments: [],
      subscriptions: [],
      error: 'Razorpay keys are not configured',
    }
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  const [paymentsRes, subscriptionsRes, linkedClinics] = await Promise.all([
    razorpay.payments.all({ count: 40 }).catch(e => ({ error: e?.error?.description || e.message, items: [] })),
    razorpay.subscriptions.all({ count: 40 }).catch(e => ({ error: e?.error?.description || e.message, items: [] })),
    db.collection('subscriptions').countDocuments({
      $or: [
        { razorpay_subscription_id: { $gt: '' } },
        { razorpay_customer_id: { $gt: '' } },
      ],
    }).catch(() => 0),
  ])

  const paymentItems = asList(paymentsRes)
  const subscriptionItems = asList(subscriptionsRes)
  const totals = summarizePayments(paymentItems)
  const errors = [paymentsRes?.error, subscriptionsRes?.error].filter(Boolean)

  return {
    configured: true,
    webhook_configured: webhook,
    key_id_masked: maskKey(keyId),
    mode: keyId.startsWith('rzp_live') ? 'live' : 'test',
    dashboard_url: DASHBOARD_URL,
    kpis: {
      captured_this_month: Math.round(totals.capturedMonthPaise / 100),
      captured_count: totals.capturedCount,
      failed_count: totals.failedCount,
      authorized_count: totals.authorizedCount,
      razorpay_subscriptions: subscriptionItems.length,
      linked_clinics: linkedClinics,
    },
    payments: paymentItems.slice(0, 25).map(mapPayment),
    subscriptions: subscriptionItems.slice(0, 25).map(mapSubscription),
    error: errors.length ? errors.join('; ') : null,
  }
}

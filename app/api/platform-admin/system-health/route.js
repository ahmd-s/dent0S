import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { getDb } from '@/lib/mongo'

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

    const checks = []

    // Mongo health
    try {
      const t0 = Date.now()
      await db.command({ ping: 1 })
      const latency = Date.now() - t0
      checks.push({
        name: 'MongoDB',
        status: latency < 100 ? 'healthy' : latency < 500 ? 'warning' : 'failed',
        value: `${latency}ms`,
        label: 'Database ping',
      })
    } catch {
      checks.push({ name: 'MongoDB', status: 'failed', value: null, label: 'Connection error' })
    }

    // Email service
    const emailOk = !!process.env.RESEND_API_KEY || !!process.env.SMTP_HOST
    checks.push({
      name: 'Email Service',
      status: emailOk ? 'healthy' : 'warning',
      value: emailOk ? 'Configured' : 'Not set',
      label: 'Email delivery',
    })

    // WhatsApp
    const waOk = !!process.env.WHATSAPP_API_KEY
    checks.push({
      name: 'WhatsApp',
      status: waOk ? 'healthy' : 'warning',
      value: waOk ? 'Configured' : 'Not set',
      label: 'WhatsApp messaging',
    })

    // Razorpay
    const rzOk = !!process.env.RAZORPAY_KEY_ID
    checks.push({
      name: 'Razorpay',
      status: rzOk ? 'healthy' : 'warning',
      value: rzOk ? 'Configured' : 'Not set',
      label: 'Payment gateway',
    })

    // Cron
    try {
      const settings = await db.collection('platform_settings').findOne({ _type: 'global' })
      const lastCron = settings?.last_cron_run
      if (!lastCron) {
        checks.push({ name: 'Cron', status: 'warning', value: 'Never', label: 'No cron run recorded' })
      } else {
        const hoursAgo = Math.floor((Date.now() - new Date(lastCron).getTime()) / (1000 * 60 * 60))
        checks.push({
          name: 'Cron',
          status: hoursAgo > 25 ? 'warning' : 'healthy',
          value: `${hoursAgo}h ago`,
          label: 'Trial/grace expiry job',
        })
      }
    } catch {
      checks.push({ name: 'Cron', status: 'failed', value: null, label: 'Read error' })
    }

    // Webhook (last Razorpay event — last subscription update)
    try {
      const lastWebhook = await db.collection('subscriptions')
        .find({})
        .sort({ updated_at: -1 })
        .limit(1)
        .toArray()

      const last = lastWebhook[0]?.updated_at
      if (!last) {
        checks.push({ name: 'Webhooks', status: 'warning', value: 'None', label: 'No webhook events recorded' })
      } else {
        const hoursAgo = Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60))
        checks.push({
          name: 'Webhooks',
          status: 'healthy',
          value: `${hoursAgo}h ago`,
          label: 'Last subscription update',
        })
      }
    } catch {
      checks.push({ name: 'Webhooks', status: 'failed', value: null, label: 'Read error' })
    }

    checks.push({
      name: 'Environment',
      status: 'healthy',
      value: process.env.NODE_ENV || 'development',
      label: 'Server environment',
    })

    checks.push({
      name: 'Server Time',
      status: 'healthy',
      value: new Date().toLocaleTimeString('en-IN'),
      label: new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' }),
    })

    return json({ checks, at: new Date().toISOString() })
  } catch (e) {
    console.error('System health error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

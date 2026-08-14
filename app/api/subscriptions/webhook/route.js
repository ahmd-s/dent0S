import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import crypto from 'crypto'
import { activateSubscription, startGracePeriod, cancelSubscription } from '@/lib/subscription-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('x-razorpay-signature')
    if (!signature) return new NextResponse('Missing signature', { status: 400 })
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex')
    if (signature !== expected) return new NextResponse('Invalid signature', { status: 400 })

    const event = JSON.parse(body)
    const eventType = event.event
    const entity = event.payload?.subscription?.entity
    if (!entity) return NextResponse.json({ ok: true })

    const db = await getDb()
    const subscription = await db.collection('subscriptions').findOne({ razorpay_subscription_id: entity.id })
    if (!subscription) return NextResponse.json({ ok: true })

    const clinicId = subscription.clinic_id
    const now = new Date()

    if (eventType === 'subscription.charged') {
      const periodEnd = new Date(entity.current_end * 1000)
      const periodStart = entity.current_start ? new Date(entity.current_start * 1000) : null
      const planType = entity.notes?.plan_type || subscription.plan_type
      await activateSubscription(db, clinicId, {
        periodEnd,
        periodStart,
        lastPaymentDate: now,
        planType: planType || null,
        clearGrace: true,
        reason: 'payment_recovered',
        clearEmergencyLock: true,
      })
    } else if (eventType === 'subscription.failed') {
      const graceEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      await startGracePeriod(db, clinicId, { graceEnd, reason: 'payment_failed' })
    } else if (eventType === 'subscription.cancelled') {
      await cancelSubscription(db, null, clinicId)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook error:', e)
    return new NextResponse('Error', { status: 500 })
  }
}

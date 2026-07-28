import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import crypto from 'crypto'
import { activateClinicAccessOnPayment } from '@/lib/clinic-subscription-sync'

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
      const planType = entity.notes?.plan_type || subscription.plan_type
      await db.collection('subscriptions').updateOne(
        { clinic_id: clinicId },
        {
          $set: {
            subscription_status: 'active',
            current_period_end: periodEnd,
            last_payment_date: now,
            grace_period_end: null,
            updated_at: now,
            ...(planType ? { plan_type: planType } : {}),
          },
        }
      )
      await activateClinicAccessOnPayment(db, clinicId)
    } else if (eventType === 'subscription.failed') {
      const graceEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      await db.collection('subscriptions').updateOne(
        { clinic_id: clinicId },
        { $set: { subscription_status: 'halted', grace_period_end: graceEnd, updated_at: now } }
      )
    } else if (eventType === 'subscription.cancelled') {
      await db.collection('subscriptions').updateOne(
        { clinic_id: clinicId },
        { $set: { subscription_status: 'cancelled', cancelled_at: now, updated_at: now } }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook error:', e)
    return new NextResponse('Error', { status: 500 })
  }
}

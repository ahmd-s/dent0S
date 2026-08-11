import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  sendAppointmentReminder,
  sendFollowupReminder,
  sendPaymentReminder,
  sendLabUpdate,
  sendTreatmentReminder,
  sendReviewRequest,
  sendBirthdayWish,
  cancelScheduledMessage,
  retryFailedMessage,
  autoScheduleReminders,
} from '@/lib/communication-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    if (url.searchParams.get('action') === 'auto_schedule') {
      return json(await autoScheduleReminders(ctx.db, ctx.profile.clinic_id))
    }

    return json({ ok: true, reminders: 'Use POST to send or schedule reminders' })
  } catch (e) {
    console.error('Reminders GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const body = await request.json()
    const { type, ...data } = body

    let result
    switch (type) {
      case 'appointment':
        result = await sendAppointmentReminder(ctx.db, ctx.profile, data)
        break
      case 'followup':
        result = await sendFollowupReminder(ctx.db, ctx.profile, data)
        break
      case 'payment':
        result = await sendPaymentReminder(ctx.db, ctx.profile, data)
        break
      case 'lab':
        result = await sendLabUpdate(ctx.db, ctx.profile, data)
        break
      case 'treatment':
        result = await sendTreatmentReminder(ctx.db, ctx.profile, data)
        break
      case 'review':
        result = await sendReviewRequest(ctx.db, ctx.profile, data)
        break
      case 'birthday':
        result = await sendBirthdayWish(ctx.db, ctx.profile, data)
        break
      case 'cancel':
        result = await cancelScheduledMessage(ctx.db, ctx.profile, data.message_id)
        break
      case 'retry':
        result = await retryFailedMessage(ctx.db, ctx.profile, data.message_id)
        break
      default:
        return err('Unknown reminder type', 400)
    }

    return json(result)
  } catch (e) {
    console.error('Reminders POST error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const messageId = url.searchParams.get('message_id')
    if (!messageId) return err('message_id required', 400)

    const { cancelScheduledMessage } = await import('@/lib/communication-engine')
    return json(await cancelScheduledMessage(ctx.db, ctx.profile, messageId))
  } catch (e) {
    console.error('Reminders DELETE error:', e)
    return err('Internal server error', 500)
  }
}

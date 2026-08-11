import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import {
  sendManualMessage,
  scheduleMessage,
  getPatientSegments,
  getReviewStats,
  recordReviewReceived,
  autoScheduleReminders,
  processScheduledMessages,
} from '@/lib/communication-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const action = url.searchParams.get('action')

    if (action === 'segments') {
      const data = await getPatientSegments(ctx.db, ctx.profile.clinic_id)
      return json({ ok: true, ...data })
    }

    if (action === 'reviews') {
      const stats = await getReviewStats(ctx.db, ctx.profile.clinic_id)
      return json(stats)
    }

    return json({ ok: true, module: 'communication', version: 'sprint-17' })
  } catch (e) {
    console.error('Communication GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'send':
        return json(await sendManualMessage(ctx.db, ctx.profile, data))
      case 'schedule':
        return json(await scheduleMessage(ctx.db, ctx.profile, data))
      case 'auto_schedule':
        return json(await autoScheduleReminders(ctx.db, ctx.profile.clinic_id))
      case 'process_scheduled':
        return json(await processScheduledMessages(ctx.db, ctx.profile.clinic_id))
      case 'review_received':
        return json(await recordReviewReceived(ctx.db, ctx.profile, data))
      default:
        return json(await sendManualMessage(ctx.db, ctx.profile, data))
    }
  } catch (e) {
    console.error('Communication POST error:', e)
    return err('Internal server error', 500)
  }
}

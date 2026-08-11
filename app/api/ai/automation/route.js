import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import {
  getAutomationQueue,
  generateDoctorDailyBrief,
  generateLabSummary,
  generateInventoryInsights,
  generateBusinessInsights,
  generateRecallSuggestion,
  generateAppointmentPreparation,
} from '@/lib/ai-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const action = new URL(request.url).searchParams.get('action') || 'queue'

    switch (action) {
      case 'brief':
        return json(await generateDoctorDailyBrief(ctx.db, ctx.profile))
      case 'lab':
        return json(await generateLabSummary(ctx.db, ctx.profile))
      case 'inventory':
        return json(await generateInventoryInsights(ctx.db, ctx.profile))
      case 'business':
        return json(await generateBusinessInsights(ctx.db, ctx.profile))
      case 'recall':
        return json(await generateRecallSuggestion(ctx.db, ctx.profile))
      default:
        return json(await getAutomationQueue(ctx.db, ctx.profile))
    }
  } catch (e) {
    console.error('AI automation error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const body = await request.json()
    if (body.action === 'appointment_prep') {
      return json(await generateAppointmentPreparation(ctx.db, ctx.profile, body))
    }
    return json(await getAutomationQueue(ctx.db, ctx.profile))
  } catch (e) {
    console.error('AI automation POST error:', e)
    return err('Internal server error', 500)
  }
}

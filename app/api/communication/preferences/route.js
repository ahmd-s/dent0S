import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { guardCommunication } from '@/lib/communication/guards'
import {
  getPatientPreferences,
  getClinicianPreferences,
  setWhatsAppOptIn,
  setWhatsAppOptOut,
  setClinicianScheduleOptIn,
  isWhatsAppOptedIn,
  cancelUnsentPatientMessages,
} from '@/lib/communication'
import { WHATSAPP_POLICY_VERSION } from '@/lib/communication/constants'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'viewPatientConsent', err)
    if (denied) return denied

    const url = new URL(request.url)
    const patientId = url.searchParams.get('patient_id')
    const profileId = url.searchParams.get('profile_id')

    if (patientId) {
      const prefs = await getPatientPreferences(ctx.db, ctx.profile.clinic_id, patientId)
      return json({
        ok: true,
        preferences: prefs,
        whatsapp_opted_in: isWhatsAppOptedIn(prefs),
      })
    }

    if (profileId) {
      const prefs = await getClinicianPreferences(ctx.db, ctx.profile.clinic_id, profileId)
      return json({ ok: true, preferences: prefs })
    }

    return err('patient_id or profile_id required', 400)
  } catch (e) {
    console.error('Communication preferences GET error')
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'editPatientConsent', err)
    if (denied) return denied

    const body = await request.json()
    const {
      patient_id: patientId,
      profile_id: profileId,
      action,
      source,
      contact_e164: contactE164,
    } = body

    if (body.clinic_id || body.clinicId) {
      return err('clinic_id must not be supplied by client', 400)
    }

    if (profileId && action === 'clinician_schedule_opt_in') {
      const profile = await ctx.db.collection('profiles').findOne({
        id: profileId,
        clinic_id: ctx.profile.clinic_id,
      })
      if (!profile) return err('Staff profile not found', 404)

      const prefs = await setClinicianScheduleOptIn(ctx.db, ctx.profile.clinic_id, profileId, {
        source,
        optedInByUserId: ctx.profile.id,
        contactE164: contactE164 || profile.whatsapp_number || profile.phone,
        policyVersion: WHATSAPP_POLICY_VERSION,
      })
      return json({ ok: true, preferences: prefs })
    }

    if (!patientId) return err('patient_id required', 400)

    const patient = await ctx.db.collection('patients').findOne({
      id: patientId,
      clinic_id: ctx.profile.clinic_id,
    })
    if (!patient) return err('Patient not found', 404)

    if (action === 'opt_out') {
      const prefs = await setWhatsAppOptOut(ctx.db, ctx.profile.clinic_id, patientId, {
        source,
        optedOutByUserId: ctx.profile.id,
        policyVersion: WHATSAPP_POLICY_VERSION,
      })
      const cancelled = await cancelUnsentPatientMessages(ctx.db, ctx.profile.clinic_id, patientId)
      return json({ ok: true, preferences: prefs, whatsapp_opted_in: false, cancelled_messages: cancelled.cancelled })
    }

    const prefs = await setWhatsAppOptIn(ctx.db, ctx.profile.clinic_id, patientId, {
      source: source || 'staff',
      optedInByUserId: ctx.profile.id,
      policyVersion: WHATSAPP_POLICY_VERSION,
    })
    return json({ ok: true, preferences: prefs, whatsapp_opted_in: true })
  } catch (e) {
    console.error('Communication preferences POST error')
    return err('Internal server error', 500)
  }
}

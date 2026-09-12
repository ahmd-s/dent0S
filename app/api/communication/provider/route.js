import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { guardCommunication } from '@/lib/communication/guards'
import {
  ensureDefaultProviderConfig,
  getProviderForClinic,
  publicWhatsAppCloudStatus,
  saveProviderCloudCredentials,
} from '@/lib/communication'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'viewQueue', err)
    if (denied) return denied

    const clinicId = ctx.profile.clinic_id
    await ensureDefaultProviderConfig(ctx.db, clinicId)
    const { config } = await getProviderForClinic(ctx.db, clinicId)
    const status = publicWhatsAppCloudStatus(config.settings, {
      appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL,
    })

    return json({
      ok: true,
      provider_key: config.provider_key,
      force_click_to_whatsapp: config.settings?.force_click_to_whatsapp === true,
      whatsapp: status,
    })
  } catch (e) {
    console.error('Communication provider GET error')
    return err('Internal server error', 500)
  }
}

export async function PATCH(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const denied = guardCommunication(ctx, 'editConfig', err)
    if (denied) return denied

    const body = await request.json()
    if (body.clinic_id || body.clinicId) {
      return err('clinic_id must not be supplied by client', 400)
    }

    await saveProviderCloudCredentials(ctx.db, ctx.profile.clinic_id, {
      access_token: body.access_token,
      phone_number_id: body.phone_number_id,
      waba_id: body.waba_id,
      send_mode: body.send_mode,
      template_language: body.template_language,
      clear_credentials: body.clear_credentials === true,
      force_click_to_whatsapp: body.force_click_to_whatsapp,
    })

    const { config } = await getProviderForClinic(ctx.db, ctx.profile.clinic_id)
    return json({
      ok: true,
      provider_key: config.provider_key,
      force_click_to_whatsapp: config.settings?.force_click_to_whatsapp === true,
      whatsapp: publicWhatsAppCloudStatus(config.settings, {
        appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL,
      }),
    })
  } catch (e) {
    console.error('Communication provider PATCH error')
    return err('Internal server error', 500)
  }
}

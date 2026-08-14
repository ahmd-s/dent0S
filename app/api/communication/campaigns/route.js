import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { createCampaign, getCampaigns, sendBulkCampaign } from '@/lib/communication-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const result = await getCampaigns(ctx.db, ctx.profile.clinic_id, {
      status: url.searchParams.get('status'),
      limit: parseInt(url.searchParams.get('limit') || '50', 10),
    })
    return json(result)
  } catch (e) {
    console.error('Campaigns GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const body = await request.json()
    if (body.action === 'send') {
      return json(await sendBulkCampaign(ctx.db, ctx.profile, { campaignId: body.campaign_id }))
    }
    return json(await createCampaign(ctx.db, ctx.profile, body))
  } catch (e) {
    console.error('Campaigns POST error:', e)
    return err('Internal server error', 500)
  }
}

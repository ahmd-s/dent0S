import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getTemplates, saveTemplate } from '@/lib/communication-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    return json(await getTemplates(ctx.db, ctx.profile.clinic_id))
  } catch (e) {
    console.error('Templates GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const body = await request.json()
    return json(await saveTemplate(ctx.db, ctx.profile, body))
  } catch (e) {
    console.error('Templates POST error:', e)
    return err('Internal server error', 500)
  }
}

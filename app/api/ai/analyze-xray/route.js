import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { analyzeXray } from '@/lib/ai-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const { imageUrl } = await request.json()
    if (!imageUrl) return err('Image URL is required', 400)

    const result = await analyzeXray(ctx.db, ctx.profile, { imageUrl })
    if (!result.ok) return err(result.error || 'Analysis failed', 502)

    return json({ findings: result.findings, disclaimer: result.disclaimer })
  } catch (e) {
    console.error('AI analysis error:', e)
    return err('Internal server error', 500)
  }
}

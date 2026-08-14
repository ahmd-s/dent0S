import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, enforceRateLimit } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { analyzeXray } from '@/lib/ai-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const rate = await enforceRateLimit(request, ctx.profile.id)
    if (!rate.allowed) return err('Rate limit exceeded. Try again later.', 429)

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

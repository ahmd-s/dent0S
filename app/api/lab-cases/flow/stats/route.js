import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { computeLabMetrics } from '@/lib/lab-workflow-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/lab-cases/flow/stats — lab metrics for dashboards */
export async function GET() {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const metrics = await computeLabMetrics(ctx.db, ctx.profile.clinic_id)
  return json({ ok: true, metrics })
}

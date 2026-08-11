import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { runDiagnostics } from '@/lib/diagnostics-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx

    const result = await runDiagnostics(db, {
      clinicId: profile.clinic_id,
      scope: 'clinic',
    })

    return json(result)
  } catch (e) {
    console.error('System diagnostics error:', e)
    return err('Internal server error', 500)
  }
}

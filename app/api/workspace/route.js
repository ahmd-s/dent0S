import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { getProfileRoles } from '@/lib/profile-roles'
import { createDefaultWorkspace, getWorkspace } from '@/lib/workspace-engine'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

function effectiveWorkspaceRole(roles) {
  const list = getProfileRoles(roles)
  if (list.includes('admin')) return 'admin'
  if (list.includes('doctor')) return 'doctor'
  if (list.includes('receptionist')) return 'receptionist'
  return list[0] || 'admin'
}

/**
 * GET /api/workspace — read merged workspace for the logged-in user's role.
 * Read-only; all authenticated clinic members.
 */
export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const clinicId = ctx.profile.clinic_id
    await createDefaultWorkspace(ctx.db, clinicId)
    const result = await getWorkspace(ctx.db, clinicId)
    if (!result.ok) return err(result.error, 400)

    const role = effectiveWorkspaceRole(ctx.profile)
    return json({
      ok: true,
      workspace: result.workspace,
      role,
      config: result.workspace[role],
      exists: result.exists,
    })
  } catch (e) {
    console.error('Workspace GET error:', e)
    return err('Internal server error', 500)
  }
}

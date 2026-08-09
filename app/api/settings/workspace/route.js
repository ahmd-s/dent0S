import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessSettings } from '@/lib/rbac'
import {
  createDefaultWorkspace,
  getWorkspace,
  saveWorkspace,
  resetClinicWorkspace,
  resetRoleWorkspace,
  WORKSPACE_ROLES,
} from '@/lib/workspace-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/settings/workspace — clinic admin reads merged workspace.
 */
export async function GET() {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (!canAccessSettings(ctx.profile)) return err('Forbidden', 403)

    const clinicId = ctx.profile.clinic_id
    await createDefaultWorkspace(ctx.db, clinicId)
    const result = await getWorkspace(ctx.db, clinicId)
    if (!result.ok) return err(result.error, 400)

    return json({
      ok: true,
      workspace: result.workspace,
      exists: result.exists,
    })
  } catch (e) {
    console.error('Settings workspace GET error:', e)
    return err('Internal server error', 500)
  }
}

/**
 * PATCH /api/settings/workspace
 *   { role, config } — save one role
 *   { roles: { admin?, doctor?, receptionist? } } — save multiple roles
 *   { reset: 'role', role } — reset one role
 *   { reset: 'all' } — reset entire clinic workspace
 */
export async function PATCH(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (!canAccessSettings(ctx.profile)) return err('Forbidden', 403)

    const clinicId = ctx.profile.clinic_id
    const body = await request.json().catch(() => ({}))

    if (body.reset === 'all') {
      const result = await resetClinicWorkspace(ctx.db, clinicId)
      if (!result.ok) return err(result.error, 400)
      return json({ ok: true, workspace: result.workspace })
    }

    if (body.reset === 'role') {
      if (!WORKSPACE_ROLES.includes(body.role)) return err('Invalid role', 400)
      const result = await resetRoleWorkspace(ctx.db, clinicId, body.role)
      if (!result.ok) return err(result.error, 400)
      return json({ ok: true, workspace: result.workspace })
    }

    let payload = {}
    if (body.roles && typeof body.roles === 'object') {
      payload = body.roles
    } else if (body.role && body.config) {
      if (!WORKSPACE_ROLES.includes(body.role)) return err('Invalid role', 400)
      payload = { [body.role]: body.config }
    } else {
      return err('Provide role+config, roles, or reset', 400)
    }

    const result = await saveWorkspace(ctx.db, clinicId, payload)
    if (!result.ok) return err(result.error, 400)

    return json({ ok: true, workspace: result.workspace })
  } catch (e) {
    console.error('Settings workspace PATCH error:', e)
    return err('Internal server error', 500)
  }
}

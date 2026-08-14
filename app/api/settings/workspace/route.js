import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { canAccessSettings } from '@/lib/rbac'
import {
  createDefaultWorkspace,
  getWorkspace,
  getPlatformTemplates,
  saveWorkspace,
  saveWorkspacePresets,
  resetClinicWorkspace,
  resetRoleWorkspace,
  resetRoleSection,
  applyPreset,
  WORKSPACE_ROLES,
} from '@/lib/workspace-engine'
import {
  logWorkspaceRoleSave,
  logWorkspaceReset,
  logWorkspacePreset,
} from '@/lib/workspace-audit'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/settings/workspace — clinic admin reads merged workspace + templates.
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

    const templates = await getPlatformTemplates(ctx.db)

    return json({
      ok: true,
      workspace: result.workspace,
      exists: result.exists,
      templates,
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
 *   { reset: 'role'|'all'|'section', role?, section? }
 *   { presets: [...] } — update presets only
 *   { preset_action: 'apply', preset_id }
 */
export async function PATCH(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (!canAccessSettings(ctx.profile)) return err('Forbidden', 403)

    const clinicId = ctx.profile.clinic_id
    const body = await request.json().catch(() => ({}))

    const clinic = await ctx.db.collection('clinics').findOne({ id: clinicId })
    const clinicName = clinic?.name || ''

    const beforeResult = await getWorkspace(ctx.db, clinicId)
    const beforeWorkspace = beforeResult.workspace

    if (body.reset === 'all') {
      const result = await resetClinicWorkspace(ctx.db, clinicId)
      if (!result.ok) return err(result.error, 400)
      await logWorkspaceReset(ctx.db, {
        actor: ctx.profile,
        clinicId,
        clinicName,
        role: 'all',
        section: 'all',
        request,
      })
      return json({ ok: true, workspace: result.workspace })
    }

    if (body.reset === 'role') {
      if (!WORKSPACE_ROLES.includes(body.role)) return err('Invalid role', 400)
      const result = await resetRoleWorkspace(ctx.db, clinicId, body.role)
      if (!result.ok) return err(result.error, 400)
      await logWorkspaceReset(ctx.db, {
        actor: ctx.profile,
        clinicId,
        clinicName,
        role: body.role,
        section: 'role',
        request,
      })
      return json({ ok: true, workspace: result.workspace })
    }

    if (body.reset === 'section') {
      if (!WORKSPACE_ROLES.includes(body.role)) return err('Invalid role', 400)
      if (!body.section) return err('section is required', 400)
      const result = await resetRoleSection(ctx.db, clinicId, body.role, body.section)
      if (!result.ok) return err(result.error, 400)
      await logWorkspaceReset(ctx.db, {
        actor: ctx.profile,
        clinicId,
        clinicName,
        role: body.role,
        section: body.section,
        request,
      })
      return json({ ok: true, workspace: result.workspace })
    }

    if (body.presets !== undefined) {
      const result = await saveWorkspacePresets(ctx.db, clinicId, body.presets)
      if (!result.ok) return err(result.error, 400)
      await logWorkspacePreset(ctx.db, {
        actor: ctx.profile,
        clinicId,
        clinicName,
        presetAction: body.preset_action || 'update',
        presetName: null,
        role: body.role || null,
        request,
      })
      return json({ ok: true, workspace: result.workspace })
    }

    if (body.preset_action === 'apply' && body.preset_id) {
      const result = await applyPreset(ctx.db, clinicId, body.preset_id)
      if (!result.ok) return err(result.error, 400)
      const preset = beforeWorkspace?.presets?.find(p => p.id === body.preset_id)
      await logWorkspacePreset(ctx.db, {
        actor: ctx.profile,
        clinicId,
        clinicName,
        presetAction: 'apply',
        presetName: preset?.name,
        role: preset?.role,
        request,
      })
      return json({ ok: true, workspace: result.workspace })
    }

    if (body.preset_action === 'apply_builtin' && body.preset_id && body.role && body.config) {
      const result = await saveWorkspace(ctx.db, clinicId, { [body.role]: body.config })
      if (!result.ok) return err(result.error, 400)
      await logWorkspacePreset(ctx.db, {
        actor: ctx.profile,
        clinicId,
        clinicName,
        presetAction: 'apply_builtin',
        presetName: body.preset_id,
        role: body.role,
        request,
      })
      return json({ ok: true, workspace: result.workspace })
    }

    let payload = {}
    if (body.roles && typeof body.roles === 'object') {
      payload = body.roles
    } else if (body.role && body.config) {
      if (!WORKSPACE_ROLES.includes(body.role)) return err('Invalid role', 400)
      payload = { [body.role]: body.config }
    } else {
      return err('Provide role+config, roles, presets, preset_action, or reset', 400)
    }

    const beforeConfig = beforeWorkspace?.[body.role]
    const result = await saveWorkspace(ctx.db, clinicId, payload)
    if (!result.ok) return err(result.error, 400)

    if (body.role && beforeConfig) {
      await logWorkspaceRoleSave(ctx.db, {
        actor: ctx.profile,
        clinicId,
        clinicName,
        role: body.role,
        beforeConfig,
        afterConfig: result.workspace[body.role],
        request,
      })
    }

    return json({ ok: true, workspace: result.workspace })
  } catch (e) {
    console.error('Settings workspace PATCH error:', e)
    return err('Internal server error', 500)
  }
}

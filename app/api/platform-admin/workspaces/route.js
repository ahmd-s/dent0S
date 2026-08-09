import { NextResponse } from 'next/server'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'
import {
  getPlatformTemplates,
  getWorkspace,
  resetClinicWorkspace,
  resetPlatformTemplates,
  updatePlatformTemplates,
  saveWorkspace,
  WORKSPACE_ROLES,
} from '@/lib/workspace-engine'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/**
 * GET /api/platform-admin/workspaces
 * Query: clinic_id (optional) — when set, returns that clinic's merged workspace.
 * Without clinic_id: returns platform default templates.
 */
export async function GET(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const clinicId = request.nextUrl.searchParams.get('clinic_id')

    if (clinicId) {
      const clinic = await db.collection('clinics').findOne({ id: clinicId })
      if (!clinic) return json({ error: 'Clinic not found' }, 404)

      const result = await getWorkspace(db, clinicId)
      if (!result.ok) return json({ error: result.error, code: result.code }, 400)

      return json({
        clinic_id: clinicId,
        clinic_name: clinic.name,
        workspace: result.workspace,
        exists: result.exists,
      })
    }

    const templates = await getPlatformTemplates(db)
    return json({ templates })
  } catch (e) {
    console.error('Platform admin workspaces GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

/**
 * PATCH /api/platform-admin/workspaces
 *
 * Body actions:
 *   { reset: 'platform' } — reset platform templates to code defaults
 *   { reset: 'clinic', clinic_id } — reset clinic workspace to platform templates
 *   { templates: { admin?, doctor?, receptionist? } } — update platform templates (partial)
 *   { clinic_id, role, config } — update one role for a clinic (partial)
 */
export async function PATCH(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const body = await request.json().catch(() => ({}))

    if (body.reset === 'platform') {
      const result = await resetPlatformTemplates(db)
      if (!result.ok) return json({ error: result.error, code: result.code }, 400)

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.WORKSPACE_TEMPLATES_RESET,
        meta: {},
      })

      return json({ ok: true, templates: result.templates })
    }

    if (body.reset === 'clinic') {
      const clinicId = body.clinic_id
      if (!clinicId) return json({ error: 'clinic_id is required for clinic reset' }, 400)

      const clinic = await db.collection('clinics').findOne({ id: clinicId })
      if (!clinic) return json({ error: 'Clinic not found' }, 404)

      const result = await resetClinicWorkspace(db, clinicId)
      if (!result.ok) return json({ error: result.error, code: result.code }, 400)

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.WORKSPACE_CLINIC_RESET,
        targetClinicId: clinicId,
        targetClinicName: clinic.name,
        meta: {},
      })

      return json({ ok: true, workspace: result.workspace })
    }

    if (body.templates !== undefined) {
      const result = await updatePlatformTemplates(db, body.templates)
      if (!result.ok) return json({ error: result.error, code: result.code }, 400)

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.WORKSPACE_TEMPLATES_UPDATED,
        meta: { roles: Object.keys(body.templates || {}) },
      })

      return json({ ok: true, templates: result.templates })
    }

    if (body.clinic_id && body.role && body.config) {
      if (!WORKSPACE_ROLES.includes(body.role)) {
        return json({ error: 'Invalid role' }, 400)
      }

      const clinic = await db.collection('clinics').findOne({ id: body.clinic_id })
      if (!clinic) return json({ error: 'Clinic not found' }, 404)

      const result = await saveWorkspace(db, body.clinic_id, { [body.role]: body.config })
      if (!result.ok) return json({ error: result.error, code: result.code }, 400)

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.WORKSPACE_CLINIC_UPDATED,
        targetClinicId: body.clinic_id,
        targetClinicName: clinic.name,
        meta: { role: body.role },
      })

      return json({ ok: true, workspace: result.workspace })
    }

    return json(
      {
        error:
          'Provide reset (platform|clinic), templates, or clinic_id+role+config',
      },
      400
    )
  } catch (e) {
    console.error('Platform admin workspaces PATCH error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

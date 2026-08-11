/**
 * Workspace change audit — reuses platform_admin_audit_logs collection.
 */

import { logPlatformAudit, AUDIT_ACTIONS, getClientIp } from '@/lib/platform-admin'
import { diffRoleConfig } from '@/lib/workspace-role-experience'
import { logEvent } from '@/lib/activity-engine'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import { actorFromProfile } from '@/lib/activity-helpers'

export { AUDIT_ACTIONS }

export async function logWorkspaceAudit(db, {
  actor,
  clinicId,
  clinicName,
  action,
  request = null,
  meta = {},
}) {
  const ip = request ? getClientIp(request) : 'unknown'
  await logPlatformAudit(db, {
    actor,
    action,
    targetClinicId: clinicId,
    targetClinicName: clinicName,
    meta: { ...meta, ip, source: 'workspace_builder' },
  })

  if (action === AUDIT_ACTIONS.WORKSPACE_ROLE_EXPERIENCE_UPDATED && meta.role) {
    await logEvent(db, {
      clinicId,
      event: ACTIVITY_EVENTS.WORKSPACE_UPDATED,
      actor: actorFromProfile(actor),
      metadata: { role: meta.role, changes: meta.changes?.length || 0 },
    })
  }
}

export async function logWorkspaceRoleSave(db, {
  actor,
  clinicId,
  clinicName,
  role,
  beforeConfig,
  afterConfig,
  request,
}) {
  const changes = diffRoleConfig(beforeConfig, afterConfig, role)
  await logWorkspaceAudit(db, {
    actor,
    clinicId,
    clinicName,
    action: AUDIT_ACTIONS.WORKSPACE_ROLE_EXPERIENCE_UPDATED,
    request,
    meta: { role, changes },
  })
}

export async function logWorkspaceReset(db, {
  actor,
  clinicId,
  clinicName,
  role,
  section,
  request,
}) {
  await logWorkspaceAudit(db, {
    actor,
    clinicId,
    clinicName,
    action: AUDIT_ACTIONS.WORKSPACE_ROLE_EXPERIENCE_RESET,
    request,
    meta: { role: role || 'all', section: section || 'all' },
  })
}

export async function logWorkspacePreset(db, {
  actor,
  clinicId,
  clinicName,
  presetAction,
  presetName,
  role,
  request,
}) {
  await logWorkspaceAudit(db, {
    actor,
    clinicId,
    clinicName,
    action: AUDIT_ACTIONS.WORKSPACE_PRESET_CHANGED,
    request,
    meta: { presetAction, presetName, role },
  })
}

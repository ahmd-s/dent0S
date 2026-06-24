import { v4 as uuidv4 } from 'uuid'

// Canonical audit action names tracked for every lab case.
export const AUDIT_ACTIONS = {
  CASE_CREATED: 'Case Created',
  FILE_UPLOADED: 'File Uploaded',
  FILE_DELETED: 'File Deleted',
  LINK_GENERATED: 'Link Generated',
  WHATSAPP_SHARED: 'WhatsApp Shared',
  LAB_OPENED_LINK: 'Lab Opened Link',
  STATUS_UPDATED: 'Status Updated',
  LAB_UPDATED_STATUS: 'Lab Updated Status',
}

// Source of an audited action.
export const AUDIT_SOURCE = {
  CLINIC: 'Clinic',
  LAB_PORTAL: 'Lab Portal',
  SYSTEM: 'System',
}

// Append an immutable entry to the audit_logs collection. Best-effort: a
// logging failure must never break the underlying operation.
export async function logAudit(db, { clinicId, labCaseId, caseNumber, action, source, actorId, actorName, meta }) {
  try {
    await db.collection('audit_logs').insertOne({
      id: uuidv4(),
      clinic_id: clinicId || null,
      lab_case_id: labCaseId || null,
      case_number: caseNumber || '',
      action,
      source: source || AUDIT_SOURCE.SYSTEM,
      actor_id: actorId || null,
      actor_name: actorName || '',
      meta: meta || {},
      at: new Date(),
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}

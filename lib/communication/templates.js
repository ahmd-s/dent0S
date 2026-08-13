import { DEFAULT_TEMPLATES } from './constants.js'

export function renderTemplate(body, vars = {}) {
  return String(body || '').replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key]
    return val == null ? '' : String(val)
  })
}

export async function resolveTemplateBody(db, clinicId, messageType, vars = {}) {
  const custom = await db.collection('message_templates').findOne({
    clinic_id: clinicId,
    type: messageType,
    is_active: { $ne: false },
  })

  const body = custom?.body || DEFAULT_TEMPLATES[messageType] || ''
  return renderTemplate(body, vars)
}

export function buildVisitSummaryVars({ patientName, clinicName, secureLink }) {
  return {
    patient_name: patientName,
    clinic_name: clinicName,
    secure_link: secureLink,
  }
}

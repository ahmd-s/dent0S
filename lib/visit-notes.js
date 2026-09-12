/** Merge visit clinical fields. Used by visit form and patient voice notes. */

export function mergeTextBlock(prev, next) {
  const n = String(next || '').trim()
  if (!n) return prev || ''
  const p = String(prev || '').trim()
  if (!p) return n
  return `${p}\n\n${n}`
}

export function mergeSingleLine(prev, next) {
  const n = String(next || '').trim()
  if (!n) return prev || ''
  const p = String(prev || '').trim()
  if (!p) return n
  return `${p}; ${n}`
}

export function applyVoiceFieldsToVisit(visit, fields) {
  const src = fields && typeof fields === 'object' ? fields : {}
  return {
    chief_complaint: mergeTextBlock(visit?.chief_complaint, src.chief_complaint),
    clinical_notes: mergeTextBlock(visit?.clinical_notes, src.clinical_notes),
    diagnosis: mergeSingleLine(visit?.diagnosis, src.diagnosis),
    treatment_done: mergeTextBlock(visit?.treatment_done, src.treatment_done),
    treatment_plan: mergeTextBlock(visit?.treatment_plan, src.treatment_plan),
    next_visit_recommended: src.next_visit_recommended ? true : visit?.next_visit_recommended,
    next_visit_date: src.next_visit_date || visit?.next_visit_date,
    next_visit_notes: src.next_visit_notes
      ? mergeTextBlock(visit?.next_visit_notes, src.next_visit_notes)
      : visit?.next_visit_notes,
  }
}

export function isOpenVisit(visit) {
  if (!visit) return false
  const workflow = visit.workflow_status || ''
  const status = visit.status || ''
  return workflow !== 'completed' && status !== 'completed'
}

export function latestOpenVisit(visits = []) {
  return visits.find(isOpenVisit) || null
}

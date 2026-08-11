/**
 * Sprint 19 — Client-side autosave utility.
 * Debounced localStorage drafts + optional server sync. Recover after refresh.
 */

const DRAFT_PREFIX = 'dentos_draft_'
const DEFAULT_DEBOUNCE_MS = 3000

export function draftKey(scope, id) {
  return `${DRAFT_PREFIX}${scope}_${id}`
}

/** Save draft to localStorage. */
export function saveDraft(scope, id, data) {
  if (typeof window === 'undefined') return false
  try {
    const key = draftKey(scope, id)
    localStorage.setItem(key, JSON.stringify({
      data,
      savedAt: new Date().toISOString(),
      scope,
      id,
    }))
    return true
  } catch {
    return false
  }
}

/** Load draft from localStorage. */
export function loadDraft(scope, id) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(draftKey(scope, id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.data ?? null
  } catch {
    return null
  }
}

/** Clear draft after successful server save. */
export function clearDraft(scope, id) {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(draftKey(scope, id))
  } catch { /* ignore */ }
}

/** Get draft metadata (savedAt). */
export function getDraftMeta(scope, id) {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(draftKey(scope, id))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { savedAt: parsed.savedAt, scope: parsed.scope, id: parsed.id }
  } catch {
    return null
  }
}

/** List all drafts for recovery UI. */
export function listDrafts() {
  if (typeof window === 'undefined') return []
  const drafts = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      const raw = localStorage.getItem(key)
      const parsed = JSON.parse(raw)
      drafts.push({
        key,
        scope: parsed.scope,
        id: parsed.id,
        savedAt: parsed.savedAt,
      })
    }
  } catch { /* ignore */ }
  return drafts.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
}

/** Create debounced save function. */
export function createDebouncedSave(fn, delayMs = DEFAULT_DEBOUNCE_MS) {
  let timer = null
  return (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delayMs)
    return () => { if (timer) clearTimeout(timer) }
  }
}

export const AUTOSAVE_SCOPES = {
  PATIENT_NOTES: 'patient_notes',
  TREATMENT_NOTES: 'treatment_notes',
  SOAP_NOTES: 'soap_notes',
  PRESCRIPTION_DRAFT: 'prescription_draft',
  WORKSPACE_BUILDER: 'workspace_builder',
  VISIT_DRAFT: 'visit_draft',
  FORM: 'form',
}

export { DEFAULT_DEBOUNCE_MS, DRAFT_PREFIX }

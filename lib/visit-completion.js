/** Visit completion workflow helpers (Phase 8). */

export const STEP_PENDING = 'pending'
export const STEP_SKIPPED = 'skipped'
export const STEP_DONE = 'done'
export const STEP_ASSIGNED = 'assigned'

export const CLINICAL_KEYS = [
  'chief_complaint',
  'clinical_notes',
  'diagnosis',
  'treatment_done',
  'treatment_plan',
  'next_visit_recommended',
  'next_visit_date',
]

export function defaultInventoryStep() {
  return { status: STEP_PENDING, assigned_to: null, completed_at: null }
}

export function defaultInvoiceStep() {
  return { status: STEP_PENDING, assigned_to: null, completed_at: null }
}

export function initVisitWorkflowFields() {
  return {
    workflow_status: 'clinical',
    clinical_saved_at: null,
    inventory_step: defaultInventoryStep(),
    invoice_step: defaultInvoiceStep(),
  }
}

export function isStepResolved(step) {
  return step?.status === STEP_DONE || step?.status === STEP_SKIPPED
}

export function bothStepsResolved(inventoryStep, invoiceStep) {
  return isStepResolved(inventoryStep) && isStepResolved(invoiceStep)
}

export function deriveWorkflowStatus(inventoryStep, invoiceStep) {
  if (bothStepsResolved(inventoryStep, invoiceStep)) return 'completed'
  if (isStepResolved(inventoryStep)) return 'invoice'
  return 'inventory'
}

/** Migrate legacy visits without workflow fields. */
export function ensureVisitWorkflow(visit) {
  if (!visit) return visit
  if (visit.workflow_status && visit.inventory_step && visit.invoice_step) return visit
  return {
    ...visit,
    workflow_status: visit.workflow_status || (visit.clinical_saved_at ? 'inventory' : 'clinical'),
    clinical_saved_at: visit.clinical_saved_at || null,
    inventory_step: visit.inventory_step || defaultInventoryStep(),
    invoice_step: visit.invoice_step || defaultInvoiceStep(),
  }
}

export function canEditAssignedStep(profileId, roles, step, action) {
  if (action !== 'complete_assigned') return true
  if (step?.status !== STEP_ASSIGNED) return false
  return step.assigned_to === profileId || roles.includes('admin')
}

/**
 * Pure planner for visit workflow transitions.
 * Does not apply `complete` — that stays in the route after other writes succeed.
 * Returns { update } or { error, status } with update: null (caller must not persist).
 */
export function planVisitWorkflowUpdate(visit, body = {}, now = new Date()) {
  const current = ensureVisitWorkflow(visit)
  const update = {}
  let inventoryStep = { ...current.inventory_step }
  let invoiceStep = { ...current.invoice_step }

  if (body.save_clinical) {
    const cc = String(body.chief_complaint ?? current.chief_complaint ?? '').trim()
    if (!cc) {
      return { error: 'Chief complaint is required', status: 400, update: null }
    }
    for (const k of CLINICAL_KEYS) {
      if (k in body) update[k] = body[k]
    }
    update.clinical_saved_at = now
    update.workflow_status = 'inventory'
    update.inventory_step = inventoryStep.status ? inventoryStep : defaultInventoryStep()
    update.invoice_step = invoiceStep.status ? invoiceStep : defaultInvoiceStep()
    update.updated_at = now
    inventoryStep = update.inventory_step
    invoiceStep = update.invoice_step
  }

  if (body.inventory_action) {
    const action = body.inventory_action
    if (action === 'skip') {
      inventoryStep = { status: STEP_SKIPPED, assigned_to: null, completed_at: now }
    } else if (action === 'done') {
      inventoryStep = { status: STEP_DONE, assigned_to: null, completed_at: now }
    } else if (action === 'assign') {
      inventoryStep = { status: STEP_ASSIGNED, assigned_to: null, completed_at: null }
    } else {
      return { error: 'Invalid inventory action', status: 400, update: null }
    }
    update.inventory_step = inventoryStep
    update.workflow_status = deriveWorkflowStatus(inventoryStep, invoiceStep)
    update.updated_at = now
  }

  if (body.invoice_action) {
    const action = body.invoice_action
    if (action === 'assign') {
      invoiceStep = { status: STEP_ASSIGNED, assigned_to: null, completed_at: null }
    } else if (action === 'done') {
      invoiceStep = { status: STEP_DONE, assigned_to: null, completed_at: now }
    } else {
      return { error: 'Invalid invoice action', status: 400, update: null }
    }
    update.invoice_step = invoiceStep
    update.workflow_status = deriveWorkflowStatus(inventoryStep, invoiceStep)
    update.updated_at = now
  }

  return { update, error: null, status: null }
}

/** Prevents overlapping save handlers (double-click / double-tap). */
export function createInFlightGuard() {
  let busy = false
  return {
    get busy() {
      return busy
    },
    async run(fn) {
      if (busy) return { skipped: true }
      busy = true
      try {
        const result = await fn()
        return { skipped: false, result }
      } finally {
        busy = false
      }
    },
  }
}

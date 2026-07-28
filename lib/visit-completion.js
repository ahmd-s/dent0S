/** Visit completion workflow helpers (Phase 8). */

export const STEP_PENDING = 'pending'
export const STEP_SKIPPED = 'skipped'
export const STEP_DONE = 'done'
export const STEP_ASSIGNED = 'assigned'

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
  if (visit.workflow_status) return visit
  return {
    ...visit,
    workflow_status: 'clinical',
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

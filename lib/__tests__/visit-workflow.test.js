import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createInFlightGuard,
  planVisitWorkflowUpdate,
  initVisitWorkflowFields,
  ensureVisitWorkflow,
} from '../visit-completion.js'

const clinicalVisit = {
  id: 'v1',
  clinic_id: 'c1',
  chief_complaint: '',
  ...initVisitWorkflowFields(),
}

describe('Save Draft stays on Clinical', () => {
  it('does not set clinical_saved_at or advance workflow_status', () => {
    const visit = { ...clinicalVisit, chief_complaint: 'Pain in 46' }
    const { update, error } = planVisitWorkflowUpdate(visit, {
      chief_complaint: 'Pain in 46',
      clinical_notes: 'Deep caries',
      complete: false,
    })
    assert.equal(error, null)
    assert.equal(update.workflow_status, undefined)
    assert.equal(update.clinical_saved_at, undefined)
    const next = ensureVisitWorkflow({ ...visit, ...update })
    assert.equal(next.workflow_status, 'clinical')
    assert.equal(next.clinical_saved_at, null)
  })
})

describe('Save Clinical & Continue advances to Inventory only after success', () => {
  it('advances workflow_status to inventory and stamps clinical_saved_at', () => {
    const now = new Date('2026-08-14T10:00:00.000Z')
    const { update, error } = planVisitWorkflowUpdate(
      { ...clinicalVisit, chief_complaint: 'Pain in 46' },
      { save_clinical: true, chief_complaint: 'Pain in 46', clinical_notes: 'Deep caries' },
      now,
    )
    assert.equal(error, null)
    assert.equal(update.workflow_status, 'inventory')
    assert.equal(update.clinical_saved_at, now)
    assert.equal(update.inventory_step.status, 'pending')
  })

  it('does not advance when persistence is not attempted (planner error)', () => {
    const { update, error } = planVisitWorkflowUpdate(clinicalVisit, {
      save_clinical: true,
      chief_complaint: '   ',
    })
    assert.equal(error, 'Chief complaint is required')
    assert.equal(update, null)
  })
})

describe('Failed save does not advance', () => {
  it('keeps the visit on clinical when chief complaint is missing', () => {
    const visit = { ...clinicalVisit }
    const planned = planVisitWorkflowUpdate(visit, { save_clinical: true })
    assert.ok(planned.error)
    assert.equal(planned.update, null)
    assert.equal(visit.workflow_status, 'clinical')
    assert.equal(visit.clinical_saved_at, null)
  })
})

describe('Double click does not create duplicate saves', () => {
  it('skips a second in-flight save so only one request runs', async () => {
    const guard = createInFlightGuard()
    let starts = 0
    const save = () => guard.run(async () => {
      starts += 1
      await new Promise(r => setTimeout(r, 30))
      return 'saved'
    })
    const [first, second] = await Promise.all([save(), save()])
    assert.equal(starts, 1)
    assert.equal(first.skipped, false)
    assert.equal(first.result, 'saved')
    assert.equal(second.skipped, true)
  })

  it('save_clinical is idempotent on the same visit (no second workflow record)', () => {
    const now = new Date('2026-08-14T10:00:00.000Z')
    const first = planVisitWorkflowUpdate(
      { ...clinicalVisit, chief_complaint: 'Pain' },
      { save_clinical: true, chief_complaint: 'Pain' },
      now,
    )
    const second = planVisitWorkflowUpdate(
      { ...clinicalVisit, ...first.update, chief_complaint: 'Pain' },
      { save_clinical: true, chief_complaint: 'Pain' },
      now,
    )
    assert.equal(first.update.workflow_status, 'inventory')
    assert.equal(second.update.workflow_status, 'inventory')
    assert.equal(second.error, null)
  })
})

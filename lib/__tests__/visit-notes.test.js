import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyVoiceFieldsToVisit, isOpenVisit, latestOpenVisit, mergeTextBlock } from '../visit-notes.js'

describe('visit note merge', () => {
  it('appends voice drafts onto existing clinical text', () => {
    const next = applyVoiceFieldsToVisit(
      { chief_complaint: 'Pain in 46', diagnosis: 'Caries' },
      { chief_complaint: 'Sensitivity to cold', diagnosis: 'Reversible pulpitis' },
    )
    assert.equal(next.chief_complaint, 'Pain in 46\n\nSensitivity to cold')
    assert.equal(next.diagnosis, 'Caries; Reversible pulpitis')
    assert.equal(mergeTextBlock('', 'Hello'), 'Hello')
  })

  it('picks the latest open visit and skips completed ones', () => {
    const visits = [
      { id: 'done', workflow_status: 'completed' },
      { id: 'open', workflow_status: 'clinical', status: 'in_progress' },
    ]
    assert.equal(isOpenVisit(visits[0]), false)
    assert.equal(latestOpenVisit(visits)?.id, 'open')
    assert.equal(latestOpenVisit([{ id: 'done', status: 'completed' }]), null)
  })
})

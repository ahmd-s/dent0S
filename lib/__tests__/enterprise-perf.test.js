import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { unwrapFindOneAndUpdate } from '../mongo-result.js'
import { mapPool } from '../async-pool.js'

describe('unwrapFindOneAndUpdate', () => {
  it('returns driver 6 documents as-is', () => {
    const doc = { id: 'j1', status: 'running' }
    assert.equal(unwrapFindOneAndUpdate(doc), doc)
  })

  it('unwraps driver 5 ModifyResult', () => {
    const doc = { id: 'j1', status: 'running' }
    assert.deepEqual(unwrapFindOneAndUpdate({ value: doc, ok: 1 }), doc)
  })

  it('unwraps mock { value } wrappers', () => {
    const doc = { id: 'm1', status: 'processing' }
    assert.deepEqual(unwrapFindOneAndUpdate({ value: doc }), doc)
  })

  it('returns null when there is no match', () => {
    assert.equal(unwrapFindOneAndUpdate(null), null)
    assert.equal(unwrapFindOneAndUpdate({ value: null, ok: 1 }), null)
  })
})

describe('mapPool', () => {
  it('preserves order under concurrency', async () => {
    const input = [1, 2, 3, 4, 5]
    const seen = []
    const out = await mapPool(input, 2, async (n) => {
      seen.push(n)
      await new Promise(r => setTimeout(r, 5 - n))
      return n * 10
    })
    assert.deepEqual(out, [10, 20, 30, 40, 50])
    assert.equal(seen.length, 5)
  })

  it('returns empty for empty input', async () => {
    assert.deepEqual(await mapPool([], 4, async x => x), [])
  })
})

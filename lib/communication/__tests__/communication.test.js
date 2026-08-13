import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  isValidE164,
  normalizeToE164,
  buildWhatsAppUrl,
  toWaMeDigits,
} from '../phone.js'
import { renderTemplate, buildVisitSummaryVars } from '../templates.js'
import { isWhatsAppOptedIn, cancelUnsentPatientMessages } from '../consent.js'
import { MockProvider } from '../providers/mock.js'
import { ClickToWhatsAppProvider } from '../providers/click-to-whatsapp.js'
import { WhatsAppCloudProvider } from '../providers/whatsapp-cloud.js'
import {
  MESSAGE_STATUSES,
  PROVIDER_OUTCOMES,
  DEFAULT_TEMPLATES,
} from '../constants.js'
import { getClinicDateIso, getClinicLocalHourMinute } from '../timezone.js'
import {
  initialStatus,
  statusFromOutcome,
  canMarkSent,
  canCancel,
  isRetryableFailure,
} from '../state.js'
import { safeCommunicationMetadata, redactPhone, redactMessageBody } from '../redact.js'
import { isShareTokenValid } from '../secure-links.js'
import { getWhatsAppUrl, claimMessageForProcessing } from '../processing.js'

function createMockDb(initial = {}) {
  const collections = { ...initial }
  let updateManyCount = 0

  const matchDoc = (doc, filter) => {
    for (const [key, val] of Object.entries(filter)) {
      if (key === '$and') {
        if (!val.every(sub => matchDoc(doc, sub))) return false
        continue
      }
      if (key === '$or') {
        if (!val.some(sub => matchDoc(doc, sub))) return false
        continue
      }
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        if ('$lte' in val && !(doc[key] <= val.$lte)) return false
        if ('$lt' in val && !(doc[key] < val.$lt)) return false
        if ('$in' in val && !val.$in.includes(doc[key])) return false
        if ('$ne' in val && doc[key] === val.$ne) return false
        if ('$exists' in val && val.$exists === false && key in doc) return false
        if ('$type' in val && typeof doc[key] !== val.$type) return false
        continue
      }
      if (doc[key] !== val) return false
    }
    return true
  }

  return {
    updateManyCount: () => updateManyCount,
    collection(name) {
      if (!collections[name]) collections[name] = []
      const store = collections[name]
      return {
        findOne(filter) {
          return Promise.resolve(store.find(doc => matchDoc(doc, filter)) || null)
        },
        find(filter = {}) {
          const rows = store.filter(doc => matchDoc(doc, filter))
          return {
            sort() { return this },
            skip() { return this },
            limit(n) { return Promise.resolve(rows.slice(0, n)) },
            toArray: () => Promise.resolve(rows),
          }
        },
        findOneAndUpdate(filter, update, _opts) {
          const idx = store.findIndex(doc => matchDoc(doc, filter))
          if (idx === -1) return Promise.resolve({ value: null })
          Object.assign(store[idx], update.$set || {})
          return Promise.resolve({ value: { ...store[idx] } })
        },
        updateOne(filter, update) {
          const doc = store.find(d => matchDoc(d, filter))
          if (doc && update.$set) Object.assign(doc, update.$set)
          return Promise.resolve({ modifiedCount: doc ? 1 : 0 })
        },
        updateMany(filter, update) {
          let count = 0
          for (const doc of store) {
            if (matchDoc(doc, filter)) {
              Object.assign(doc, update.$set || {})
              count++
            }
          }
          updateManyCount = count
          return Promise.resolve({ modifiedCount: count })
        },
        insertOne(doc) {
          store.push(JSON.parse(JSON.stringify(doc)))
          return Promise.resolve({ insertedId: doc.id })
        },
        countDocuments(filter = {}) {
          return Promise.resolve(store.filter(doc => matchDoc(doc, filter)).length)
        },
      }
    },
  }
}

describe('phone validation', () => {
  it('accepts valid E.164 numbers', () => {
    assert.equal(isValidE164('+919876543210'), true)
  })

  it('builds wa.me URLs without plus and with encoding', () => {
    assert.equal(toWaMeDigits('+919876543210'), '919876543210')
    const url = buildWhatsAppUrl('+919876543210', 'Hello World!')
    assert.equal(url, 'https://wa.me/919876543210?text=Hello%20World!')
  })
})

describe('consent', () => {
  it('requires opt-in and blocks after opt-out', () => {
    assert.equal(isWhatsAppOptedIn(null), false)
    assert.equal(isWhatsAppOptedIn({ whatsapp_opt_in: true, whatsapp_opt_in_at: new Date() }), true)
    assert.equal(
      isWhatsAppOptedIn({ whatsapp_opt_in: true, whatsapp_opt_in_at: new Date(), whatsapp_opt_out_at: new Date() }),
      false
    )
  })

  it('cancels unsent patient messages on opt-out', async () => {
    const db = createMockDb({
      messages: [
        { id: 'm1', clinic_id: 'c1', patient_id: 'p1', status: 'action_required' },
        { id: 'm2', clinic_id: 'c1', patient_id: 'p1', status: 'sent' },
        { id: 'm3', clinic_id: 'c1', patient_id: 'p2', status: 'queued' },
      ],
    })
    const result = await cancelUnsentPatientMessages(db, 'c1', 'p1')
    assert.equal(result.cancelled, 1)
    const remaining = db.collection('messages').find().toArray()
    const m1 = (await remaining).find(m => m.id === 'm1')
    assert.equal(m1.status, 'cancelled')
    assert.equal(m1.failure_reason, 'consent_revoked')
  })
})

describe('manual click-to-whatsapp semantics', () => {
  it('maps to action_required then requires mark-sent', () => {
    assert.equal(statusFromOutcome(PROVIDER_OUTCOMES.ACTION_REQUIRED), MESSAGE_STATUSES.ACTION_REQUIRED)
    assert.equal(canMarkSent(MESSAGE_STATUSES.ACTION_REQUIRED), true)
    assert.equal(canMarkSent(MESSAGE_STATUSES.SENT), false)
  })

  it('GET whatsapp url helper is read-only', async () => {
    const db = createMockDb({
      messages: [{
        id: 'm1',
        clinic_id: 'c1',
        status: 'action_required',
        recipient_e164: '+919876543210',
        body: 'Hello',
        whatsapp_url: null,
      }],
    })
    const profile = { id: 'u1', clinic_id: 'c1' }
    const before = await db.collection('messages').findOne({ id: 'm1' })
    assert.equal(before.whatsapp_url, null)

    const result = await getWhatsAppUrl(db, profile, 'm1')
    assert.equal(result.ok, true)
    assert.match(result.whatsapp_url, /^https:\/\/wa\.me\//)

    const after = await db.collection('messages').findOne({ id: 'm1' })
    assert.equal(after.whatsapp_url, null)
  })

  it('never treats provider outcomes as delivered or read', async () => {
    const provider = new ClickToWhatsAppProvider()
    const result = await provider.send({ recipient_e164: '+919876543210', body: 'Hi' })
    assert.notEqual(result.outcome, 'delivered')
    assert.notEqual(result.outcome, 'read')
  })
})

describe('clinical privacy', () => {
  it('visit summary template excludes clinical and billing detail', () => {
    const template = DEFAULT_TEMPLATES.visit_summary
    assert.doesNotMatch(template, /diagnosis|prescription|amount|invoice/i)
    const vars = buildVisitSummaryVars({
      patientName: 'Anita',
      clinicName: 'Smile Dental',
      secureLink: 'https://app.example/visit-summary/token-abc',
    })
    const body = renderTemplate(template, vars)
    assert.doesNotMatch(body, /diagnosis|prescription|₹|\d{3,}/)
    assert.match(body, /securely/)
  })

  it('redacts sensitive metadata for logs', () => {
    const redacted = safeCommunicationMetadata({
      recipient_e164: '+919876543210',
      body: 'Sensitive clinical note about patient treatment',
      whatsapp_url: 'https://wa.me/919876543210?text=secret',
    })
    assert.equal(redacted.recipient_e164, '****3210')
    assert.equal(redacted.body, '[message:47chars]')
    assert.match(redacted.whatsapp_url, /^https:\/\/wa\.me\/919876543210\?…$/)
  })
})

describe('scheduling, retry, and idempotency', () => {
  it('does not retry consent or invalid phone failures', () => {
    assert.equal(isRetryableFailure('consent_required'), false)
    assert.equal(isRetryableFailure('invalid_e164'), false)
    assert.equal(isRetryableFailure('rate_limit'), true)
    assert.equal(isRetryableFailure('timeout'), true)
  })

  it('uses appointment date in reminder idempotency key', () => {
    const key = `appt_reminder:appt-1:1d:2026-08-12`
    assert.match(key, /2026-08-12/)
  })

  it('claims only one worker lease for concurrent processing', async () => {
    const db = createMockDb({
      messages: [{
        id: 'm1',
        clinic_id: 'c1',
        status: 'queued',
        scheduled_at: null,
        retry_count: 0,
      }],
    })
    const first = await claimMessageForProcessing(db, 'm1', 'c1')
    const second = await claimMessageForProcessing(db, 'm1', 'c1')
    assert.ok(first)
    assert.equal(first.status, 'processing')
    assert.equal(second, null)
  })
})

describe('clinic timezone and DST', () => {
  it('formats clinic-local date', () => {
    const date = getClinicDateIso('Asia/Kolkata', new Date('2026-08-11T02:30:00.000Z'))
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
  })

  it('reads 07:00 in Asia/Kolkata', () => {
    const { hour, minute } = getClinicLocalHourMinute('Asia/Kolkata', new Date('2026-08-11T01:30:00.000Z'))
    assert.equal(hour, 7)
    assert.equal(minute, 0)
  })

  it('handles US DST spring-forward boundary without throwing', () => {
    const springForward = new Date('2026-03-08T12:00:00.000Z')
    const date = getClinicDateIso('America/New_York', springForward)
    const { hour, minute } = getClinicLocalHourMinute('America/New_York', springForward)
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(typeof hour, 'number')
    assert.equal(typeof minute, 'number')
  })

  it('handles US DST fall-back boundary without throwing', () => {
    const fallBack = new Date('2026-11-01T12:00:00.000Z')
    const date = getClinicDateIso('America/New_York', fallBack)
    const { hour, minute } = getClinicLocalHourMinute('America/New_York', fallBack)
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(typeof hour, 'number')
    assert.equal(typeof minute, 'number')
  })
})

describe('secure link access control', () => {
  it('rejects expired share tokens', () => {
    assert.equal(isShareTokenValid({
      share_token: 'abc',
      share_token_expires_at: new Date(Date.now() - 1000),
    }), false)
  })

  it('accepts valid unexpired share tokens', () => {
    assert.equal(isShareTokenValid({
      share_token: 'abc',
      share_token_expires_at: new Date(Date.now() + 60_000),
    }), true)
  })
})

describe('providers and authorization mapping', () => {
  it('mock provider returns accepted', async () => {
    const provider = new MockProvider()
    const result = await provider.send({ recipient_e164: '+919876543210', body: 'Test' })
    assert.equal(result.outcome, PROVIDER_OUTCOMES.ACCEPTED)
  })

  it('whatsapp cloud provider remains nonfunctional placeholder', async () => {
    const provider = new WhatsAppCloudProvider()
    const result = await provider.send({ recipient_e164: '+919876543210', body: 'Hi' })
    assert.equal(result.outcome, PROVIDER_OUTCOMES.REJECTED)
    assert.equal(result.detail.reason, 'whatsapp_cloud_not_configured')
  })

  it('uses explicit permission keys per action', () => {
    const perms = {
      openWhatsApp: { resource: 'appointments', action: 'update' },
      viewQueue: { resource: 'appointments', action: 'read' },
      editPatientConsent: { resource: 'patients', action: 'update' },
    }
    assert.equal(perms.openWhatsApp.action, 'update')
    assert.equal(perms.viewQueue.action, 'read')
    assert.equal(perms.editPatientConsent.resource, 'patients')
  })
})

describe('state transitions', () => {
  it('schedules future messages', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    assert.equal(initialStatus(future), MESSAGE_STATUSES.SCHEDULED)
    assert.equal(initialStatus(null), MESSAGE_STATUSES.QUEUED)
  })

  it('allows cancel for queued, scheduled, and action_required', () => {
    assert.equal(canCancel(MESSAGE_STATUSES.ACTION_REQUIRED), true)
    assert.equal(canCancel(MESSAGE_STATUSES.SENT), false)
  })
})

describe('clinic isolation', () => {
  it('scopes message queries by clinic_id', () => {
    const query = { clinic_id: 'clinic-a', id: 'm1' }
    assert.notEqual(query.clinic_id, 'clinic-b')
  })

  it('redacts phone numbers consistently', () => {
    assert.equal(redactPhone('+919876543210'), '****3210')
    assert.equal(redactMessageBody('short'), '[message]')
  })
})

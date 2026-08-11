/**
 * Communication Engine — single communication layer for DentOS (Sprint 17).
 * All outbound patient communication flows through this module.
 * API routes must delegate here — no communication logic in routes.
 */

import { v4 as uuidv4 } from 'uuid'
import { sendWhatsApp } from '@/lib/whatsapp'
import {
  logCommunicationEvent,
  logCommunicationStatusChange,
  logCampaignEvent,
  logReviewEvent,
} from '@/lib/communication-activity'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

const CACHE_TTL_MS = 60_000
const cache = new Map()

export const MESSAGE_TYPES = {
  APPOINTMENT_REMINDER: 'appointment_reminder',
  FOLLOWUP_REMINDER: 'followup_reminder',
  INVOICE_REMINDER: 'invoice_reminder',
  PAYMENT_REMINDER: 'payment_reminder',
  LAB_UPDATE: 'lab_update',
  TREATMENT_REMINDER: 'treatment_reminder',
  REVIEW_REQUEST: 'review_request',
  BIRTHDAY_WISH: 'birthday_wish',
  ANNIVERSARY_WISH: 'anniversary_wish',
  CAMPAIGN: 'campaign',
  MANUAL: 'manual',
  MISSED_APPOINTMENT: 'missed_appointment',
}

export const MESSAGE_STATUS = {
  SCHEDULED: 'scheduled',
  PENDING: 'pending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  READ: 'read',
}

export const CHANNELS = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
  EMAIL: 'email',
  PUSH: 'push',
  IN_APP: 'in_app',
}

export const CAMPAIGN_AUDIENCES = [
  'all_patients',
  'inactive_patients',
  'pending_treatment',
  'unpaid_balance',
  'treatment_specific',
  'birthday',
  'recall',
]

export const PATIENT_SEGMENTS = [
  'new_patients',
  'vip_patients',
  'inactive_patients',
  'pending_treatment',
  'followup_due',
  'outstanding_balance',
  'high_value',
  'frequent_visitors',
  'lab_pending',
  'review_pending',
]

const DEFAULT_TEMPLATES = [
  { key: 'appointment_reminder_1d', type: MESSAGE_TYPES.APPOINTMENT_REMINDER, subject: 'Appointment Reminder', body: 'Hi {{patient_name}}, reminder: your appointment at {{clinic_name}} is tomorrow at {{appointment_time}}.' },
  { key: 'appointment_reminder_2h', type: MESSAGE_TYPES.APPOINTMENT_REMINDER, subject: 'Appointment Today', body: 'Hi {{patient_name}}, your appointment at {{clinic_name}} is in 2 hours at {{appointment_time}}.' },
  { key: 'followup_reminder', type: MESSAGE_TYPES.FOLLOWUP_REMINDER, subject: 'Follow-up Due', body: 'Hi {{patient_name}}, your follow-up at {{clinic_name}} is due. Please call us to schedule.' },
  { key: 'payment_reminder', type: MESSAGE_TYPES.PAYMENT_REMINDER, subject: 'Payment Reminder', body: 'Hi {{patient_name}}, you have an outstanding balance of {{amount}} at {{clinic_name}}.' },
  { key: 'lab_ready', type: MESSAGE_TYPES.LAB_UPDATE, subject: 'Lab Work Ready', body: 'Hi {{patient_name}}, your lab work is ready at {{clinic_name}}. Please visit to collect.' },
  { key: 'review_request', type: MESSAGE_TYPES.REVIEW_REQUEST, subject: 'Share Your Feedback', body: 'Hi {{patient_name}}, thank you for visiting {{clinic_name}}. We would love your feedback!' },
  { key: 'birthday_wish', type: MESSAGE_TYPES.BIRTHDAY_WISH, subject: 'Happy Birthday!', body: 'Happy Birthday {{patient_name}}! Wishing you a wonderful day from all of us at {{clinic_name}}.' },
]

function cacheKey(clinicId, fn, opts = {}) {
  return `${clinicId}:${fn}:${JSON.stringify(opts)}`
}

function getCached(key) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data
  return null
}

function setCache(key, data) {
  cache.set(key, { data, at: Date.now() })
  if (cache.size > 200) cache.delete(cache.keys().next().value)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function renderTemplate(body, vars = {}) {
  return String(body || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
}

function cleanDoc(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

/** Provider adapters — future-ready placeholders */
const PROVIDERS = {
  async whatsapp(to, message) {
    if (!to) return { ok: false, reason: 'no_recipient' }
    await sendWhatsApp(to, message)
    return { ok: true, channel: CHANNELS.WHATSAPP }
  },
  async sms(to, message) {
    if (!process.env.SMS_SERVICE_URL) return { ok: true, channel: CHANNELS.SMS, placeholder: true }
    return { ok: true, channel: CHANNELS.SMS, placeholder: true }
  },
  async email(to, subject, body) {
    if (!process.env.RESEND_API_KEY) return { ok: true, channel: CHANNELS.EMAIL, placeholder: true }
    return { ok: true, channel: CHANNELS.EMAIL, placeholder: true }
  },
  async push(_to, _message) {
    return { ok: true, channel: CHANNELS.PUSH, placeholder: true }
  },
  async in_app(db, clinicId, patientId, message) {
    try {
      await db.collection('notifications').insertOne({
        id: uuidv4(),
        clinic_id: clinicId,
        type: 'communication',
        patient_id: patientId,
        message: message.slice(0, 300),
        read: false,
        created_at: new Date(),
      })
      return { ok: true, channel: CHANNELS.IN_APP }
    } catch {
      return { ok: false, channel: CHANNELS.IN_APP }
    }
  },
}

async function dispatchMessage(db, msg) {
  const body = msg.body || ''
  const channel = msg.channel || CHANNELS.WHATSAPP
  const to = msg.recipient || msg.phone || msg.email

  let result = { ok: false }
  if (channel === CHANNELS.WHATSAPP) result = await PROVIDERS.whatsapp(to, body)
  else if (channel === CHANNELS.SMS) result = await PROVIDERS.sms(to, body)
  else if (channel === CHANNELS.EMAIL) result = await PROVIDERS.email(to, msg.subject, body)
  else if (channel === CHANNELS.PUSH) result = await PROVIDERS.push(to, body)
  else if (channel === CHANNELS.IN_APP) result = await PROVIDERS.in_app(db, msg.clinic_id, msg.patient_id, body)

  return result
}

async function persistMessage(db, doc) {
  const now = new Date()
  const message = {
    id: uuidv4(),
    created_at: now,
    updated_at: now,
    read_at: null,
    retry_count: 0,
    ...doc,
  }
  await db.collection('communication_messages').insertOne(message)
  return message
}

async function updateMessageStatus(db, messageId, clinicId, status, extra = {}) {
  await db.collection('communication_messages').updateOne(
    { id: messageId, clinic_id: clinicId },
    { $set: { status, updated_at: new Date(), ...extra } }
  )
}

async function getClinicContext(db, clinicId) {
  const clinic = await db.collection('clinics').findOne({ id: clinicId })
  return { clinic_name: clinic?.name || 'the clinic' }
}

async function resolvePatient(db, clinicId, patientId) {
  if (!patientId) return null
  return db.collection('patients').findOne({ id: patientId, clinic_id: clinicId, is_archived: { $ne: true } })
}

async function sendCore(db, profile, opts) {
  const clinicId = profile.clinic_id
  const patient = opts.patient_id ? await resolvePatient(db, clinicId, opts.patient_id) : null
  const ctx = await getClinicContext(db, clinicId)

  const vars = {
    patient_name: patient?.name || opts.patient_name || 'Patient',
    clinic_name: ctx.clinic_name,
    appointment_time: opts.appointment_time || '',
    amount: opts.amount != null ? `₹${opts.amount}` : '',
    ...opts.vars,
  }

  const body = renderTemplate(opts.body || opts.message || '', vars)
  const scheduledAt = opts.scheduled_at ? new Date(opts.scheduled_at) : null
  const isScheduled = scheduledAt && scheduledAt > new Date()

  const base = {
    clinic_id: clinicId,
    patient_id: opts.patient_id || null,
    patient_name: patient?.name || opts.patient_name || '',
    appointment_id: opts.appointment_id || null,
    visit_id: opts.visit_id || null,
    invoice_id: opts.invoice_id || null,
    lab_case_id: opts.lab_case_id || null,
    campaign_id: opts.campaign_id || null,
    type: opts.type || MESSAGE_TYPES.MANUAL,
    channel: opts.channel || CHANNELS.WHATSAPP,
    subject: opts.subject || '',
    body,
    recipient: patient?.phone || opts.recipient || opts.phone || '',
    status: isScheduled ? MESSAGE_STATUS.SCHEDULED : MESSAGE_STATUS.PENDING,
    scheduled_at: scheduledAt,
    delivery_status: null,
    read_status: 'unread',
    created_by: profile?.id || null,
    created_by_name: profile?.full_name || profile?.name || '',
  }

  const message = await persistMessage(db, base)

  if (isScheduled) {
    await logCommunicationEvent(db, profile, message)
    return { ok: true, message: cleanDoc(message), scheduled: true }
  }

  try {
    const result = await dispatchMessage(db, message)
    const status = result.ok ? MESSAGE_STATUS.DELIVERED : MESSAGE_STATUS.FAILED
    await updateMessageStatus(db, message.id, clinicId, status, {
      delivery_status: result.ok ? 'delivered' : 'failed',
      delivered_at: result.ok ? new Date() : null,
      failure_reason: result.reason || null,
    })
    message.status = status
    await logCommunicationStatusChange(db, profile, message, status)
    return { ok: result.ok, message: cleanDoc({ ...message, status }) }
  } catch (e) {
    await updateMessageStatus(db, message.id, clinicId, MESSAGE_STATUS.FAILED, {
      failure_reason: e.message,
    })
    message.status = MESSAGE_STATUS.FAILED
    await logCommunicationStatusChange(db, profile, message, MESSAGE_STATUS.FAILED)
    return { ok: false, message: cleanDoc(message), error: e.message }
  }
}

export async function sendAppointmentReminder(db, profile, { patientId, appointmentId, body, channel, scheduledAt, reminderType = '1d' }) {
  const appt = appointmentId
    ? await db.collection('appointments').findOne({ id: appointmentId, clinic_id: profile.clinic_id })
    : null
  return sendCore(db, profile, {
    patient_id: patientId || appt?.patient_id,
    appointment_id: appointmentId,
    type: MESSAGE_TYPES.APPOINTMENT_REMINDER,
    body: body || DEFAULT_TEMPLATES.find(t => t.key === `appointment_reminder_${reminderType}`)?.body,
    channel,
    scheduled_at: scheduledAt,
    appointment_time: appt?.appointment_time || '',
    vars: { reminder_type: reminderType },
  })
}

export async function sendFollowupReminder(db, profile, { patientId, body, channel, scheduledAt }) {
  return sendCore(db, profile, {
    patient_id: patientId,
    type: MESSAGE_TYPES.FOLLOWUP_REMINDER,
    body: body || DEFAULT_TEMPLATES.find(t => t.key === 'followup_reminder')?.body,
    channel,
    scheduled_at: scheduledAt,
  })
}

export async function sendInvoiceReminder(db, profile, { patientId, invoiceId, amount, body, channel, scheduledAt }) {
  return sendCore(db, profile, {
    patient_id: patientId,
    invoice_id: invoiceId,
    type: MESSAGE_TYPES.INVOICE_REMINDER,
    body: body || 'Hi {{patient_name}}, invoice reminder from {{clinic_name}}.',
    amount,
    channel,
    scheduled_at: scheduledAt,
  })
}

export async function sendPaymentReminder(db, profile, { patientId, amount, body, channel, scheduledAt }) {
  return sendCore(db, profile, {
    patient_id: patientId,
    type: MESSAGE_TYPES.PAYMENT_REMINDER,
    body: body || DEFAULT_TEMPLATES.find(t => t.key === 'payment_reminder')?.body,
    amount,
    channel,
    scheduled_at: scheduledAt,
  })
}

export async function sendLabUpdate(db, profile, { patientId, labCaseId, body, channel, scheduledAt }) {
  return sendCore(db, profile, {
    patient_id: patientId,
    lab_case_id: labCaseId,
    type: MESSAGE_TYPES.LAB_UPDATE,
    body: body || DEFAULT_TEMPLATES.find(t => t.key === 'lab_ready')?.body,
    channel,
    scheduled_at: scheduledAt,
  })
}

export async function sendTreatmentReminder(db, profile, { patientId, visitId, body, channel, scheduledAt }) {
  return sendCore(db, profile, {
    patient_id: patientId,
    visit_id: visitId,
    type: MESSAGE_TYPES.TREATMENT_REMINDER,
    body: body || 'Hi {{patient_name}}, reminder about your treatment at {{clinic_name}}.',
    channel,
    scheduled_at: scheduledAt,
  })
}

export async function sendReviewRequest(db, profile, { patientId, visitId, body, channel, scheduledAt }) {
  const result = await sendCore(db, profile, {
    patient_id: patientId,
    visit_id: visitId,
    type: MESSAGE_TYPES.REVIEW_REQUEST,
    body: body || DEFAULT_TEMPLATES.find(t => t.key === 'review_request')?.body,
    channel,
    scheduled_at: scheduledAt,
  })

  if (result.ok && patientId) {
    const review = {
      id: uuidv4(),
      clinic_id: profile.clinic_id,
      patient_id: patientId,
      visit_id: visitId || null,
      message_id: result.message?.id,
      status: 'requested',
      rating: null,
      source: 'dentos',
      google_ready: true,
      created_at: new Date(),
      updated_at: new Date(),
    }
    await db.collection('communication_reviews').insertOne(review)
    await logReviewEvent(db, profile, review, ACTIVITY_EVENTS.REVIEW_REQUESTED)
  }
  return result
}

export async function sendBirthdayWish(db, profile, { patientId, body, channel, scheduledAt }) {
  return sendCore(db, profile, {
    patient_id: patientId,
    type: MESSAGE_TYPES.BIRTHDAY_WISH,
    body: body || DEFAULT_TEMPLATES.find(t => t.key === 'birthday_wish')?.body,
    channel,
    scheduled_at: scheduledAt,
  })
}

export async function sendBulkCampaign(db, profile, { campaignId }) {
  const campaign = await db.collection('communication_campaigns').findOne({
    id: campaignId,
    clinic_id: profile.clinic_id,
  })
  if (!campaign) return { ok: false, error: 'Campaign not found' }

  const audience = await resolveCampaignAudience(db, profile.clinic_id, campaign)
  const results = []
  const batchSize = 50

  for (let i = 0; i < audience.length; i += batchSize) {
    const batch = audience.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(patient =>
      sendCore(db, profile, {
        patient_id: patient.id,
        type: MESSAGE_TYPES.CAMPAIGN,
        campaign_id: campaignId,
        body: campaign.message || campaign.body,
        subject: campaign.subject,
        channel: campaign.channel || CHANNELS.WHATSAPP,
      }).catch(() => ({ ok: false, patient_id: patient.id }))
    ))
    results.push(...batchResults)
  }

  const sent = results.filter(r => r.ok).length
  await db.collection('communication_campaigns').updateOne(
    { id: campaignId },
    { $set: { status: 'sent', sent_count: sent, total_audience: audience.length, sent_at: new Date(), updated_at: new Date() } }
  )
  await logCampaignEvent(db, profile, campaign, ACTIVITY_EVENTS.CAMPAIGN_SENT)

  return { ok: true, sent, total: audience.length, campaign_id: campaignId }
}

export async function sendManualMessage(db, profile, opts) {
  return sendCore(db, profile, { ...opts, type: MESSAGE_TYPES.MANUAL })
}

export async function scheduleMessage(db, profile, opts) {
  if (!opts.scheduled_at) return { ok: false, error: 'scheduled_at required' }
  return sendCore(db, profile, { ...opts, scheduled_at: opts.scheduled_at })
}

export async function cancelScheduledMessage(db, profile, messageId) {
  const msg = await db.collection('communication_messages').findOne({
    id: messageId,
    clinic_id: profile.clinic_id,
    status: MESSAGE_STATUS.SCHEDULED,
  })
  if (!msg) return { ok: false, error: 'Scheduled message not found' }

  await updateMessageStatus(db, messageId, profile.clinic_id, MESSAGE_STATUS.CANCELLED)
  await logCommunicationStatusChange(db, profile, msg, MESSAGE_STATUS.CANCELLED)
  return { ok: true, message_id: messageId }
}

export async function retryFailedMessage(db, profile, messageId) {
  const msg = await db.collection('communication_messages').findOne({
    id: messageId,
    clinic_id: profile.clinic_id,
    status: MESSAGE_STATUS.FAILED,
  })
  if (!msg) return { ok: false, error: 'Failed message not found' }

  const result = await dispatchMessage(db, msg)
  const status = result.ok ? MESSAGE_STATUS.DELIVERED : MESSAGE_STATUS.FAILED
  await updateMessageStatus(db, messageId, profile.clinic_id, status, {
    retry_count: (msg.retry_count || 0) + 1,
    delivery_status: result.ok ? 'delivered' : 'failed',
    delivered_at: result.ok ? new Date() : null,
  })
  await logCommunicationStatusChange(db, profile, msg, status)
  return { ok: result.ok, message_id: messageId, status }
}

export async function getCommunicationHistory(db, clinicId, opts = {}) {
  const { patientId, type, status, limit = 50, skip = 0, from, to } = opts
  const query = { clinic_id: clinicId }
  if (patientId) query.patient_id = patientId
  if (type) query.type = type
  if (status) query.status = status
  if (from || to) {
    query.created_at = {}
    if (from) query.created_at.$gte = new Date(from)
    if (to) query.created_at.$lte = new Date(to)
  }

  const [messages, total] = await Promise.all([
    db.collection('communication_messages')
      .find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(Math.min(limit, 200))
      .toArray(),
    db.collection('communication_messages').countDocuments(query),
  ])

  return { ok: true, messages: messages.map(cleanDoc), total, pagination: { skip, limit } }
}

/** Process due scheduled messages — queue-ready batch handler */
export async function processScheduledMessages(db, clinicId = null) {
  const now = new Date()
  const query = { status: MESSAGE_STATUS.SCHEDULED, scheduled_at: { $lte: now } }
  if (clinicId) query.clinic_id = clinicId

  const due = await db.collection('communication_messages').find(query).limit(100).toArray()
  let processed = 0

  for (const msg of due) {
    try {
      const result = await dispatchMessage(db, msg)
      const status = result.ok ? MESSAGE_STATUS.DELIVERED : MESSAGE_STATUS.FAILED
      await updateMessageStatus(db, msg.id, msg.clinic_id, status, {
        delivery_status: result.ok ? 'delivered' : 'failed',
        delivered_at: result.ok ? new Date() : null,
      })
      processed++
    } catch { /* best-effort */ }
  }
  return { ok: true, processed }
}

/** Auto-schedule reminders for upcoming events */
export async function autoScheduleReminders(db, clinicId) {
  const today = todayIso()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowIso = tomorrow.toISOString().slice(0, 10)

  const systemProfile = { clinic_id: clinicId, id: 'system', full_name: 'System' }
  let scheduled = 0

  const appointments = await db.collection('appointments').find({
    clinic_id: clinicId,
    appointment_date: { $in: [today, tomorrowIso] },
    status: { $nin: ['cancelled', 'no_show', 'completed'] },
  }).toArray()

  for (const appt of appointments) {
    const reminderType = appt.appointment_date === tomorrowIso ? '1d' : '2h'
    const existing = await db.collection('communication_messages').findOne({
      clinic_id: clinicId,
      appointment_id: appt.id,
      type: MESSAGE_TYPES.APPOINTMENT_REMINDER,
      'vars.reminder_type': reminderType,
    })
    if (!existing) {
      const scheduledAt = reminderType === '1d'
        ? new Date(`${tomorrowIso}T09:00:00`)
        : new Date(`${today}T${appt.appointment_time || '09:00'}:00`)
      scheduledAt.setHours(scheduledAt.getHours() - (reminderType === '1d' ? 0 : 2))

      await sendAppointmentReminder(db, systemProfile, {
        patientId: appt.patient_id,
        appointmentId: appt.id,
        reminderType,
        scheduledAt: scheduledAt > new Date() ? scheduledAt : null,
      })
      scheduled++
    }
  }

  const followups = await db.collection('patients').find({
    clinic_id: clinicId,
    is_archived: { $ne: true },
    next_followup_date: { $lte: today },
  }).limit(50).toArray()

  for (const p of followups) {
    const existing = await db.collection('communication_messages').findOne({
      clinic_id: clinicId,
      patient_id: p.id,
      type: MESSAGE_TYPES.FOLLOWUP_REMINDER,
      created_at: { $gte: new Date(today) },
    })
    if (!existing) {
      await sendFollowupReminder(db, systemProfile, { patientId: p.id })
      scheduled++
    }
  }

  const birthdays = await db.collection('patients').find({
    clinic_id: clinicId,
    is_archived: { $ne: true },
    date_of_birth: { $regex: `-${today.slice(5)}` },
  }).toArray()

  for (const p of birthdays) {
    const existing = await db.collection('communication_messages').findOne({
      clinic_id: clinicId,
      patient_id: p.id,
      type: MESSAGE_TYPES.BIRTHDAY_WISH,
      created_at: { $gte: new Date(today) },
    })
    if (!existing) {
      await sendBirthdayWish(db, systemProfile, { patientId: p.id })
      scheduled++
    }
  }

  return { ok: true, scheduled }
}

/** Dynamic patient segmentation — no duplicate collections */
export async function getPatientSegments(db, clinicId) {
  const key = cacheKey(clinicId, 'segments')
  const cached = getCached(key)
  if (cached) return cached

  const today = todayIso()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [patients, invoices, labCases, reviews] = await Promise.all([
    db.collection('patients').find({ clinic_id: clinicId, is_archived: { $ne: true } }).toArray(),
    db.collection('invoices').find({ clinic_id: clinicId, payment_status: { $in: ['pending', 'partial'] } }).toArray(),
    db.collection('lab_cases').find({ clinic_id: clinicId, status: { $nin: ['completed', 'delivered', 'cancelled'] } }).toArray(),
    db.collection('communication_reviews').find({ clinic_id: clinicId, status: 'requested' }).toArray(),
  ])

  const balanceMap = {}
  for (const inv of invoices) {
    balanceMap[inv.patient_id] = (balanceMap[inv.patient_id] || 0) + (inv.total_amount - (inv.paid_amount || 0))
  }

  const labPendingSet = new Set(labCases.map(l => l.patient_id))
  const reviewPendingSet = new Set(reviews.map(r => r.patient_id))

  const segments = {
    new_patients: [],
    vip_patients: [],
    inactive_patients: [],
    pending_treatment: [],
    followup_due: [],
    outstanding_balance: [],
    high_value: [],
    frequent_visitors: [],
    lab_pending: [],
    review_pending: [],
  }

  for (const p of patients) {
    const entry = { id: p.id, name: p.name, phone: p.phone }
    if ((p.total_visits || 0) === 0) segments.new_patients.push(entry)
    if ((p.total_visits || 0) >= 10 || (p.lifetime_value || 0) >= 50000) segments.vip_patients.push(entry)
    if (p.last_visit_date && new Date(p.last_visit_date) < ninetyDaysAgo) segments.inactive_patients.push(entry)
    if (p.treatment_plan && !p.treatment_done) segments.pending_treatment.push(entry)
    if (p.next_followup_date && p.next_followup_date <= today) segments.followup_due.push(entry)
    if (balanceMap[p.id] > 0) segments.outstanding_balance.push({ ...entry, balance: balanceMap[p.id] })
    if ((p.lifetime_value || 0) >= 25000) segments.high_value.push(entry)
    if ((p.total_visits || 0) >= 5) segments.frequent_visitors.push(entry)
    if (labPendingSet.has(p.id)) segments.lab_pending.push(entry)
    if (reviewPendingSet.has(p.id)) segments.review_pending.push(entry)
  }

  const counts = Object.fromEntries(Object.entries(segments).map(([k, v]) => [k, v.length]))
  const result = { segments, counts }
  setCache(key, result)
  return result
}

export async function resolveCampaignAudience(db, clinicId, campaign) {
  const { segments } = await getPatientSegments(db, clinicId)
  const filters = campaign.filters || {}

  let pool = []
  switch (campaign.audience) {
    case 'inactive_patients': pool = segments.inactive_patients; break
    case 'pending_treatment': pool = segments.pending_treatment; break
    case 'unpaid_balance': pool = segments.outstanding_balance; break
    case 'birthday': pool = segments.new_patients; break
    case 'recall': pool = segments.followup_due; break
    default: {
      const all = await db.collection('patients').find({ clinic_id: clinicId, is_archived: { $ne: true } }).toArray()
      pool = all.map(p => ({ id: p.id, name: p.name, phone: p.phone, gender: p.gender, date_of_birth: p.date_of_birth }))
    }
  }

  if (filters.gender) pool = pool.filter(p => p.gender === filters.gender)
  if (filters.doctor_id) {
    const pids = await db.collection('appointments').distinct('patient_id', {
      clinic_id: clinicId,
      doctor_id: filters.doctor_id,
    })
    const set = new Set(pids)
    pool = pool.filter(p => set.has(p.id))
  }
  if (filters.min_age || filters.max_age) {
    pool = pool.filter(p => {
      if (!p.date_of_birth) return true
      const age = Math.floor((Date.now() - new Date(p.date_of_birth)) / (365.25 * 24 * 3600 * 1000))
      if (filters.min_age && age < filters.min_age) return false
      if (filters.max_age && age > filters.max_age) return false
      return true
    })
  }

  return pool
}

export async function createCampaign(db, profile, data) {
  const now = new Date()
  const campaign = {
    id: uuidv4(),
    clinic_id: profile.clinic_id,
    name: data.name,
    subject: data.subject || '',
    message: data.message || data.body || '',
    audience: data.audience || 'all_patients',
    filters: data.filters || {},
    channel: data.channel || CHANNELS.WHATSAPP,
    status: data.scheduled_at ? 'scheduled' : 'draft',
    scheduled_at: data.scheduled_at ? new Date(data.scheduled_at) : null,
    sent_count: 0,
    total_audience: 0,
    created_by: profile.id,
    created_at: now,
    updated_at: now,
  }
  await db.collection('communication_campaigns').insertOne(campaign)
  await logCampaignEvent(db, profile, campaign, ACTIVITY_EVENTS.CAMPAIGN_CREATED)
  return { ok: true, campaign: cleanDoc(campaign) }
}

export async function getCampaigns(db, clinicId, opts = {}) {
  const query = { clinic_id: clinicId }
  if (opts.status) query.status = opts.status
  const campaigns = await db.collection('communication_campaigns')
    .find(query)
    .sort({ created_at: -1 })
    .limit(opts.limit || 50)
    .toArray()
  return { ok: true, campaigns: campaigns.map(cleanDoc) }
}

export async function getTemplates(db, clinicId) {
  const custom = await db.collection('communication_templates')
    .find({ clinic_id: clinicId })
    .sort({ created_at: -1 })
    .toArray()
  return { ok: true, templates: [...DEFAULT_TEMPLATES, ...custom.map(cleanDoc)] }
}

export async function saveTemplate(db, profile, data) {
  const template = {
    id: uuidv4(),
    clinic_id: profile.clinic_id,
    key: data.key || `custom_${Date.now()}`,
    type: data.type || MESSAGE_TYPES.MANUAL,
    subject: data.subject || '',
    body: data.body || '',
    channel: data.channel || CHANNELS.WHATSAPP,
    created_at: new Date(),
    updated_at: new Date(),
  }
  await db.collection('communication_templates').insertOne(template)
  return { ok: true, template: cleanDoc(template) }
}

export async function getCommunicationDashboard(db, clinicId) {
  const key = cacheKey(clinicId, 'dashboard')
  const cached = getCached(key)
  if (cached) return cached

  const today = todayIso()
  const startOfDay = new Date(today)
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)

  const baseQuery = { clinic_id: clinicId, created_at: { $gte: startOfDay, $lte: endOfDay } }

  const [
    todaysReminders,
    scheduledToday,
    delivered,
    failed,
    pending,
    reviewRequests,
    birthdays,
    paymentReminders,
    labNotifications,
    appointmentReminders,
    lastMessages,
    scheduledMessages,
  ] = await Promise.all([
    db.collection('communication_messages').countDocuments({ ...baseQuery, type: { $in: Object.values(MESSAGE_TYPES) } }),
    db.collection('communication_messages').countDocuments({ clinic_id: clinicId, status: MESSAGE_STATUS.SCHEDULED, scheduled_at: { $gte: startOfDay, $lte: endOfDay } }),
    db.collection('communication_messages').countDocuments({ ...baseQuery, status: { $in: [MESSAGE_STATUS.SENT, MESSAGE_STATUS.DELIVERED] } }),
    db.collection('communication_messages').countDocuments({ ...baseQuery, status: MESSAGE_STATUS.FAILED }),
    db.collection('communication_messages').countDocuments({ clinic_id: clinicId, status: MESSAGE_STATUS.PENDING }),
    db.collection('communication_reviews').countDocuments({ clinic_id: clinicId, status: 'requested' }),
    db.collection('patients').countDocuments({ clinic_id: clinicId, is_archived: { $ne: true }, date_of_birth: { $regex: `-${today.slice(5)}` } }),
    db.collection('communication_messages').countDocuments({ ...baseQuery, type: MESSAGE_TYPES.PAYMENT_REMINDER }),
    db.collection('communication_messages').countDocuments({ ...baseQuery, type: MESSAGE_TYPES.LAB_UPDATE }),
    db.collection('communication_messages').countDocuments({ ...baseQuery, type: MESSAGE_TYPES.APPOINTMENT_REMINDER }),
    db.collection('communication_messages').find({ clinic_id: clinicId }).sort({ created_at: -1 }).limit(10).toArray(),
    db.collection('communication_messages').find({ clinic_id: clinicId, status: MESSAGE_STATUS.SCHEDULED }).sort({ scheduled_at: 1 }).limit(10).toArray(),
  ])

  const result = {
    ok: true,
    todays_reminders: todaysReminders,
    scheduled_today: scheduledToday,
    delivered,
    failed,
    pending,
    review_requests: reviewRequests,
    birthdays,
    payment_reminders: paymentReminders,
    lab_notifications: labNotifications,
    appointment_reminders: appointmentReminders,
    recent_activity: lastMessages.map(cleanDoc),
    upcoming_scheduled: scheduledMessages.map(cleanDoc),
  }
  setCache(key, result)
  return result
}

export async function getPatientCommunicationCenter(db, clinicId, patientId) {
  const [history, scheduled, patient] = await Promise.all([
    getCommunicationHistory(db, clinicId, { patientId, limit: 20 }),
    db.collection('communication_messages').find({
      clinic_id: clinicId,
      patient_id: patientId,
      status: MESSAGE_STATUS.SCHEDULED,
    }).sort({ scheduled_at: 1 }).toArray(),
    resolvePatient(db, clinicId, patientId),
  ])

  const lastComm = history.messages[0] || null
  const nextScheduled = scheduled[0] || null

  return {
    ok: true,
    patient: patient ? cleanDoc(patient) : null,
    upcoming_reminders: scheduled.filter(m => m.scheduled_at > new Date()).map(cleanDoc),
    pending_reminders: scheduled.filter(m => m.scheduled_at <= new Date()).map(cleanDoc),
    history: history.messages,
    scheduled_messages: scheduled.map(cleanDoc),
    last_communication: lastComm,
    next_scheduled: nextScheduled ? cleanDoc(nextScheduled) : null,
  }
}

export async function getReviewStats(db, clinicId) {
  const [requested, received, pending, ignored, avgAgg] = await Promise.all([
    db.collection('communication_reviews').countDocuments({ clinic_id: clinicId, status: 'requested' }),
    db.collection('communication_reviews').countDocuments({ clinic_id: clinicId, status: 'received' }),
    db.collection('communication_reviews').countDocuments({ clinic_id: clinicId, status: 'pending' }),
    db.collection('communication_reviews').countDocuments({ clinic_id: clinicId, status: 'ignored' }),
    db.collection('communication_reviews').aggregate([
      { $match: { clinic_id: clinicId, rating: { $ne: null } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]).toArray(),
  ])

  return {
    ok: true,
    requested,
    received,
    pending,
    ignored,
    average_rating: avgAgg[0] ? Math.round(avgAgg[0].avg * 10) / 10 : null,
    rated_count: avgAgg[0]?.count || 0,
    google_integration_ready: true,
  }
}

export async function recordReviewReceived(db, profile, { reviewId, rating, feedback }) {
  await db.collection('communication_reviews').updateOne(
    { id: reviewId, clinic_id: profile.clinic_id },
    { $set: { status: 'received', rating, feedback, received_at: new Date(), updated_at: new Date() } }
  )
  const review = await db.collection('communication_reviews').findOne({ id: reviewId })
  await logReviewEvent(db, profile, review, ACTIVITY_EVENTS.REVIEW_RECEIVED)
  return { ok: true, review: cleanDoc(review) }
}

/** Analytics — consumed by Analytics Engine */
export async function computeCommunicationMetrics(db, clinicId, range) {
  const { start, end } = range
  const query = { clinic_id: clinicId, created_at: { $gte: start, $lte: end } }

  const [total, delivered, failed, byType, campaigns] = await Promise.all([
    db.collection('communication_messages').countDocuments(query),
    db.collection('communication_messages').countDocuments({ ...query, status: { $in: [MESSAGE_STATUS.SENT, MESSAGE_STATUS.DELIVERED] } }),
    db.collection('communication_messages').countDocuments({ ...query, status: MESSAGE_STATUS.FAILED }),
    db.collection('communication_messages').aggregate([
      { $match: query },
      { $group: { _id: '$type', count: { $sum: 1 }, delivered: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered']] }, 1, 0] } } } },
    ]).toArray(),
    db.collection('communication_campaigns').countDocuments({ clinic_id: clinicId, status: 'sent', sent_at: { $gte: start, $lte: end } }),
  ])

  const deliveryPct = total ? Math.round((delivered / total) * 1000) / 10 : 0
  const failurePct = total ? Math.round((failed / total) * 1000) / 10 : 0

  const reminderTypes = [MESSAGE_TYPES.APPOINTMENT_REMINDER, MESSAGE_TYPES.FOLLOWUP_REMINDER, MESSAGE_TYPES.PAYMENT_REMINDER]
  const reminders = byType.filter(t => reminderTypes.includes(t._id))
  const reminderTotal = reminders.reduce((s, t) => s + t.count, 0)
  const reminderDelivered = reminders.reduce((s, t) => s + t.delivered, 0)

  const reviewStats = await getReviewStats(db, clinicId)

  return {
    messages_sent: total,
    delivered,
    failed,
    delivery_pct: deliveryPct,
    failure_pct: failurePct,
    reminder_success_pct: reminderTotal ? Math.round((reminderDelivered / reminderTotal) * 1000) / 10 : 0,
    campaign_success: campaigns,
    review_conversion_pct: reviewStats.requested
      ? Math.round((reviewStats.received / (reviewStats.requested + reviewStats.received)) * 1000) / 10
      : 0,
    by_type: Object.fromEntries(byType.map(t => [t._id, { count: t.count, delivered: t.delivered }])),
    reviews: reviewStats,
  }
}

/** Platform-wide communication health */
export async function getPlatformCommunicationAnalytics(db) {
  const key = 'platform:communication'
  const cached = getCached(key)
  if (cached) return cached

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [totalMessages, failedMessages, campaigns, clinicActivity] = await Promise.all([
    db.collection('communication_messages').countDocuments({ created_at: { $gte: monthStart } }),
    db.collection('communication_messages').countDocuments({ created_at: { $gte: monthStart }, status: MESSAGE_STATUS.FAILED }),
    db.collection('communication_campaigns').countDocuments({ created_at: { $gte: monthStart } }),
    db.collection('communication_messages').aggregate([
      { $match: { created_at: { $gte: monthStart } } },
      { $group: { _id: '$clinic_id', count: { $sum: 1 }, delivered: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered']] }, 1, 0] } } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray(),
  ])

  const clinics = await db.collection('clinics').find({ id: { $in: clinicActivity.map(c => c._id) } }).toArray()
  const clinicMap = Object.fromEntries(clinics.map(c => [c.id, c.name]))

  const result = {
    messages_sent: totalMessages,
    communication_health_pct: totalMessages ? Math.round(((totalMessages - failedMessages) / totalMessages) * 1000) / 10 : 100,
    campaign_usage: campaigns,
    most_active_clinics: clinicActivity.map(c => ({
      clinic_id: c._id,
      name: clinicMap[c._id] || c._id,
      messages: c.count,
      delivery_pct: c.count ? Math.round((c.delivered / c.count) * 1000) / 10 : 0,
    })),
    failures: failedMessages,
    reminder_success_placeholder: true,
    review_statistics_placeholder: true,
  }
  setCache(key, result)
  return result
}

export function clearCommunicationCache(clinicId) {
  if (!clinicId) { cache.clear(); return }
  for (const k of cache.keys()) {
    if (k.startsWith(`${clinicId}:`)) cache.delete(k)
  }
}

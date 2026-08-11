/**
 * lib/activity-engine.js
 *
 * Centralized Activity & Event Engine for DentOS.
 * Single source for patient timeline, clinic activity, dashboard widgets, and analytics.
 *
 * Design rules:
 *   - Functions accept (db, ...) — no HTTP, no auth.
 *   - logEvent is best-effort — never throws.
 *   - Query functions return { ok, events, pagination } or { ok: false, error }.
 */

import { v4 as uuidv4 } from 'uuid'
import {
  ACTIVITY_EVENTS,
  ALL_ACTIVITY_EVENTS,
  ALL_ACTIVITY_MODULES,
  EVENT_MODULE_MAP,
  getEventLabel,
  getModuleForEvent,
} from '@/lib/activity-event-registry'

export { ACTIVITY_EVENTS }

const COLLECTION = 'activity_events'
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

function cleanEvent(doc) {
  if (!doc) return null
  const { _id, ...rest } = doc
  return {
    ...rest,
    label: getEventLabel(rest.event),
  }
}

function buildFilter({
  clinicId,
  patientId,
  visitId,
  appointmentId,
  invoiceId,
  labCaseId,
  module,
  event,
  actorId,
  dateFrom,
  dateTo,
  events,
  modules,
}) {
  const filter = {}

  if (clinicId) filter.clinic_id = clinicId
  if (patientId) filter.patient_id = patientId
  if (visitId) filter.visit_id = visitId
  if (appointmentId) filter.appointment_id = appointmentId
  if (invoiceId) filter.invoice_id = invoiceId
  if (labCaseId) filter.lab_case_id = labCaseId
  if (module) filter.module = module
  if (event) filter.event = event
  if (actorId) filter.actor_id = actorId

  if (Array.isArray(events) && events.length) filter.event = { $in: events }
  if (Array.isArray(modules) && modules.length) filter.module = { $in: modules }

  if (dateFrom || dateTo) {
    filter.created_at = {}
    if (dateFrom) filter.created_at.$gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      if (dateTo.length <= 10) end.setHours(23, 59, 59, 999)
      filter.created_at.$lte = end
    }
  }

  return filter
}

/**
 * Append an immutable activity event. Best-effort — failures are logged, never thrown.
 */
export async function logEvent(db, {
  clinicId,
  event,
  module,
  actor = {},
  patientId = null,
  visitId = null,
  appointmentId = null,
  invoiceId = null,
  labCaseId = null,
  metadata = {},
} = {}) {
  if (!clinicId || !event) {
    console.error('Activity log skipped: clinicId and event are required')
    return null
  }

  const resolvedModule = module || getModuleForEvent(event)
  if (!ALL_ACTIVITY_MODULES.includes(resolvedModule)) {
    console.warn(`Activity log: unknown module "${resolvedModule}" for event ${event}`)
  }

  try {
    const doc = {
      id: uuidv4(),
      clinic_id: clinicId,
      patient_id: patientId || null,
      visit_id: visitId || null,
      appointment_id: appointmentId || null,
      invoice_id: invoiceId || null,
      lab_case_id: labCaseId || null,
      module: resolvedModule,
      event,
      actor_id: actor.id || null,
      actor_name: actor.name || '',
      actor_role: actor.role || '',
      metadata: metadata || {},
      created_at: new Date(),
    }

    await db.collection(COLLECTION).insertOne(doc)
    return doc
  } catch (e) {
    console.error('Activity log error:', e)
    return null
  }
}

async function queryTimeline(db, filter, opts = {}) {
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)
  const page = Math.max(parseInt(opts.page, 10) || 1, 1)
  const skip = (page - 1) * limit

  const sort = { created_at: -1, id: -1 }

  if (opts.cursor) {
    try {
      const cursorDate = new Date(opts.cursor)
      if (!Number.isNaN(cursorDate.getTime())) {
        filter.created_at = { ...(filter.created_at || {}), $lt: cursorDate }
      }
    } catch {
      // ignore invalid cursor
    }
  }

  const [events, total] = await Promise.all([
    db.collection(COLLECTION).find(filter).sort(sort).skip(opts.cursor ? 0 : skip).limit(limit).toArray(),
    opts.cursor ? null : db.collection(COLLECTION).countDocuments(filter),
  ])

  const cleaned = events.map(cleanEvent)
  const last = cleaned[cleaned.length - 1]
  const nextCursor = cleaned.length === limit && last ? last.created_at : null

  return {
    ok: true,
    events: cleaned,
    pagination: {
      page: opts.cursor ? 1 : page,
      limit,
      total: total ?? cleaned.length,
      total_pages: total != null ? Math.ceil(total / limit) : 1,
      has_more: !!nextCursor,
      next_cursor: nextCursor,
    },
  }
}

export async function getClinicTimeline(db, clinicId, opts = {}) {
  if (!clinicId) return { ok: false, error: 'clinicId is required', code: 'MISSING_CLINIC_ID' }

  const filter = buildFilter({
    clinicId,
    module: opts.module,
    event: opts.event,
    actorId: opts.actorId ?? opts.actor_id,
    dateFrom: opts.dateFrom ?? opts.from,
    dateTo: opts.dateTo ?? opts.to,
    events: opts.events,
    modules: opts.modules,
    patientId: opts.patientId,
  })

  return queryTimeline(db, filter, opts)
}

export async function getPatientTimeline(db, clinicId, patientId, opts = {}) {
  if (!clinicId || !patientId) {
    return { ok: false, error: 'clinicId and patientId are required', code: 'MISSING_PARAMS' }
  }

  const filter = buildFilter({
    clinicId,
    patientId,
    module: opts.module,
    event: opts.event,
    actorId: opts.actorId ?? opts.actor_id,
    dateFrom: opts.dateFrom ?? opts.from,
    dateTo: opts.dateTo ?? opts.to,
    events: opts.events,
    modules: opts.modules,
  })

  return queryTimeline(db, filter, opts)
}

export async function getVisitTimeline(db, clinicId, visitId, opts = {}) {
  if (!clinicId || !visitId) {
    return { ok: false, error: 'clinicId and visitId are required', code: 'MISSING_PARAMS' }
  }

  const filter = buildFilter({
    clinicId,
    visitId,
    module: opts.module,
    event: opts.event,
    dateFrom: opts.dateFrom ?? opts.from,
    dateTo: opts.dateTo ?? opts.to,
  })

  return queryTimeline(db, filter, opts)
}

export async function getAppointmentTimeline(db, clinicId, appointmentId, opts = {}) {
  if (!clinicId || !appointmentId) {
    return { ok: false, error: 'clinicId and appointmentId are required', code: 'MISSING_PARAMS' }
  }

  const filter = buildFilter({
    clinicId,
    appointmentId,
    module: opts.module,
    event: opts.event,
    dateFrom: opts.dateFrom ?? opts.from,
    dateTo: opts.dateTo ?? opts.to,
  })

  return queryTimeline(db, filter, opts)
}

export async function getInvoiceTimeline(db, clinicId, invoiceId, opts = {}) {
  if (!clinicId || !invoiceId) {
    return { ok: false, error: 'clinicId and invoiceId are required', code: 'MISSING_PARAMS' }
  }

  const filter = buildFilter({
    clinicId,
    invoiceId,
    module: opts.module,
    event: opts.event,
    dateFrom: opts.dateFrom ?? opts.from,
    dateTo: opts.dateTo ?? opts.to,
  })

  return queryTimeline(db, filter, opts)
}

export async function getLabTimeline(db, clinicId, labCaseId, opts = {}) {
  if (!clinicId || !labCaseId) {
    return { ok: false, error: 'clinicId and labCaseId are required', code: 'MISSING_PARAMS' }
  }

  const filter = buildFilter({
    clinicId,
    labCaseId,
    module: opts.module,
    event: opts.event,
    dateFrom: opts.dateFrom ?? opts.from,
    dateTo: opts.dateTo ?? opts.to,
  })

  return queryTimeline(db, filter, opts)
}

/** Parse URL search params into timeline query options. */
export function parseTimelineQuery(searchParams) {
  const get = key => searchParams.get(key) || undefined
  const limit = get('limit')
  const page = get('page')
  const cursor = get('cursor')

  const events = get('events')
  const modules = get('modules')

  return {
    limit,
    page,
    cursor,
    module: get('module'),
    event: get('event'),
    actorId: get('actor_id') || get('actor'),
    dateFrom: get('from') || get('date_from'),
    dateTo: get('to') || get('date_to'),
    events: events ? events.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    modules: modules ? modules.split(',').map(s => s.trim()).filter(Boolean) : undefined,
  }
}

export function validateTimelineFilters(opts = {}) {
  if (opts.event && !ALL_ACTIVITY_EVENTS.includes(opts.event)) {
    return { ok: false, error: `Invalid event: ${opts.event}` }
  }
  if (opts.module && !ALL_ACTIVITY_MODULES.includes(opts.module)) {
    return { ok: false, error: `Invalid module: ${opts.module}` }
  }
  if (opts.events?.some(e => !ALL_ACTIVITY_EVENTS.includes(e))) {
    return { ok: false, error: 'Invalid event in events filter' }
  }
  if (opts.modules?.some(m => !ALL_ACTIVITY_MODULES.includes(m))) {
    return { ok: false, error: 'Invalid module in modules filter' }
  }
  return { ok: true }
}

/** Group events by day label for timeline UI. */
export { groupEventsByDay } from '@/lib/activity-ui'

export { EVENT_MODULE_MAP, getEventLabel, getModuleForEvent }

import { getDb } from './mongo.js'

const DAY_SECONDS = 24 * 60 * 60

/**
 * Every index DentOS relies on, declared as data.
 *
 * This used to be ~110 sequential `await createIndex(...)` calls interleaved
 * with progress logs. As a spec it can be created in parallel (one round-trip
 * per index instead of 110 serial ones), diffed against the live database, and
 * read without scrolling.
 *
 * Ordering rule for compound keys: equality fields first, then sort fields,
 * then range fields. A compound index only serves queries that use a *prefix*
 * of its keys — `{ clinic_id: 1, id: 1 }` does nothing for `findOne({ id })`.
 */
export const INDEX_SPEC = [
  // ---------------------------------------------------------------- patients
  { collection: 'patients', keys: { clinic_id: 1 } },
  { collection: 'patients', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'patients', keys: { clinic_id: 1, patient_code: 1 } },
  { collection: 'patients', keys: { clinic_id: 1, phone: 1 } },
  { collection: 'patients', keys: { clinic_id: 1, is_archived: 1 } },
  { collection: 'patients', keys: { clinic_id: 1, last_visit_date: -1 } },
  { collection: 'patients', keys: { clinic_id: 1, next_followup_date: 1 } },
  { collection: 'patients', keys: { clinic_id: 1, is_archived: 1, next_followup_date: 1 } },

  // ------------------------------------------------------------ appointments
  { collection: 'appointments', keys: { clinic_id: 1 } },
  { collection: 'appointments', keys: { clinic_id: 1, appointment_date: -1, appointment_time: 1 } },
  { collection: 'appointments', keys: { clinic_id: 1, patient_id: 1 } },
  { collection: 'appointments', keys: { clinic_id: 1, doctor_id: 1 } },
  { collection: 'appointments', keys: { clinic_id: 1, appointment_date: -1 } },
  { collection: 'appointments', keys: { clinic_id: 1, chair_id: 1, appointment_date: 1 } },
  { collection: 'appointments', keys: { clinic_id: 1, status: 1, appointment_date: 1 } },
  // Dashboard: today's queue, completed counts, doctor scope.
  { collection: 'appointments', keys: { clinic_id: 1, appointment_date: 1, status: 1 } },
  { collection: 'appointments', keys: { clinic_id: 1, appointment_date: 1, doctor_id: 1, appointment_time: 1 } },

  // ------------------------------------------------------------------ chairs
  { collection: 'clinic_chairs', keys: { clinic_id: 1 } },
  { collection: 'clinic_chairs', keys: { clinic_id: 1, is_active: 1 } },

  // ------------------------------------------------------------- block times
  { collection: 'block_times', keys: { clinic_id: 1, doctor_id: 1, date: 1 } },
  { collection: 'block_times', keys: { clinic_id: 1, date: 1, is_active: 1 } },

  // ------------------------------------------------------------------ visits
  { collection: 'visits', keys: { clinic_id: 1 } },
  { collection: 'visits', keys: { clinic_id: 1, patient_id: 1 } },
  { collection: 'visits', keys: { clinic_id: 1, doctor_id: 1 } },
  { collection: 'visits', keys: { clinic_id: 1, appointment_id: 1 } },
  { collection: 'visits', keys: { clinic_id: 1, visit_date: -1 } },
  { collection: 'visits', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'visits', keys: { clinic_id: 1, patient_id: 1, visit_date: -1, created_at: -1 } },
  { collection: 'visits', keys: { clinic_id: 1, id: 1 } },
  { collection: 'visits', keys: { clinic_id: 1, workflow_status: 1, updated_at: -1 } },
  { collection: 'visits', keys: { share_token: 1 }, options: { unique: true, sparse: true } },

  // ----------------------------------------------------------- prescriptions
  { collection: 'prescriptions', keys: { clinic_id: 1 } },
  { collection: 'prescriptions', keys: { clinic_id: 1, visit_id: 1 } },
  { collection: 'prescriptions', keys: { clinic_id: 1, id: 1 } },

  // ---------------------------------------------------------------- invoices
  { collection: 'invoices', keys: { clinic_id: 1 } },
  { collection: 'invoices', keys: { clinic_id: 1, visit_id: 1 } },
  { collection: 'invoices', keys: { clinic_id: 1, patient_id: 1 } },
  { collection: 'invoices', keys: { clinic_id: 1, invoice_date: -1 } },
  { collection: 'invoices', keys: { clinic_id: 1, id: 1 } },
  { collection: 'invoices', keys: { clinic_id: 1, payment_status: 1, invoice_date: -1 } },
  { collection: 'invoice_items', keys: { clinic_id: 1 } },
  { collection: 'invoice_items', keys: { clinic_id: 1, invoice_id: 1 } },

  // ---------------------------------------------------- profiles and clinics
  { collection: 'profiles', keys: { clinic_id: 1 } },
  { collection: 'profiles', keys: { clinic_id: 1, id: 1 } },
  { collection: 'profiles', keys: { clinic_id: 1, email: 1 } },
  { collection: 'profiles', keys: { is_platform_admin: 1 }, options: { sparse: true } },
  { collection: 'clinics', keys: { slug: 1 } },
  { collection: 'clinics', keys: { id: 1 } },

  // --------------------------------------------------------------- lab cases
  { collection: 'lab_cases', keys: { clinic_id: 1 } },
  { collection: 'lab_cases', keys: { clinic_id: 1, patient_id: 1 } },
  { collection: 'lab_cases', keys: { clinic_id: 1, vendor_id: 1 } },
  { collection: 'lab_cases', keys: { clinic_id: 1, status: 1 } },
  { collection: 'lab_cases', keys: { clinic_id: 1, status: 1, expected_delivery_date: 1 } },

  // --------------------------------------------------------------- inventory
  { collection: 'inventory_items', keys: { clinic_id: 1, is_active: 1 } },
  { collection: 'inventory_items', keys: { clinic_id: 1, item_name: 1 } },
  { collection: 'stock_movements', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'stock_movements', keys: { clinic_id: 1, item_id: 1, created_at: -1 } },
  { collection: 'inventory_purchases', keys: { clinic_id: 1, status: 1 } },
  { collection: 'inventory_purchases', keys: { clinic_id: 1, received_at: -1 } },
  { collection: 'inventory_batches', keys: { clinic_id: 1, expiry_date: 1 } },

  // ---------------------------------------------------------------- counters
  { collection: 'counters', keys: { clinic_id: 1, type: 1 }, options: { unique: true } },

  // ---------------------------------------------------------- platform admin
  { collection: 'platform_admin_audit_logs', keys: { at: -1 } },
  { collection: 'platform_admin_audit_logs', keys: { target_clinic_id: 1, at: -1 } },
  { collection: 'clinic_manual_payments', keys: { clinic_id: 1, date: -1 } },
  { collection: 'login_rate_limits', keys: { key: 1 }, options: { unique: true } },

  // -------------------------------------------------------------- workspaces
  { collection: 'clinic_workspaces', keys: { clinic_id: 1 }, options: { unique: true } },

  // --------------------------------------------------------- activity events
  { collection: 'activity_events', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { patient_id: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { visit_id: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { appointment_id: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { module: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { event: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { clinic_id: 1, module: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { clinic_id: 1, event: 1, created_at: -1 } },
  { collection: 'activity_events', keys: { clinic_id: 1, event: 1, actor_id: 1, created_at: -1 } },

  // --------------------------------------------------- communication (legacy)
  { collection: 'communication_messages', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'communication_messages', keys: { clinic_id: 1, patient_id: 1, created_at: -1 } },
  { collection: 'communication_messages', keys: { clinic_id: 1, status: 1, scheduled_at: 1 } },
  { collection: 'communication_messages', keys: { clinic_id: 1, type: 1, created_at: -1 } },
  { collection: 'communication_messages', keys: { clinic_id: 1, appointment_id: 1 } },
  { collection: 'communication_campaigns', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'communication_campaigns', keys: { clinic_id: 1, status: 1 } },
  { collection: 'communication_templates', keys: { clinic_id: 1 } },
  { collection: 'communication_reviews', keys: { clinic_id: 1, status: 1 } },
  { collection: 'communication_reviews', keys: { clinic_id: 1, patient_id: 1 } },

  // ------------------------------------------- communication (provider-agnostic)
  { collection: 'messages', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'messages', keys: { clinic_id: 1, status: 1, scheduled_at: 1 } },
  { collection: 'messages', keys: { clinic_id: 1, patient_id: 1, created_at: -1 } },
  { collection: 'messages', keys: { clinic_id: 1, type: 1, created_at: -1 } },
  {
    collection: 'messages',
    keys: { clinic_id: 1, idempotency_key: 1 },
    options: { unique: true, partialFilterExpression: { idempotency_key: { $type: 'string' } } },
  },
  { collection: 'message_attempts', keys: { clinic_id: 1, message_id: 1, created_at: -1 } },
  { collection: 'message_templates', keys: { clinic_id: 1, type: 1 } },
  {
    collection: 'communication_preferences',
    keys: { clinic_id: 1, patient_id: 1 },
    options: { unique: true, partialFilterExpression: { patient_id: { $type: 'string' } } },
  },
  {
    collection: 'communication_preferences',
    keys: { clinic_id: 1, profile_id: 1 },
    options: { unique: true, partialFilterExpression: { profile_id: { $type: 'string' } } },
  },
  { collection: 'provider_configs', keys: { clinic_id: 1 }, options: { unique: true } },
  { collection: 'communication_events', keys: { clinic_id: 1, message_id: 1, created_at: -1 } },
  { collection: 'communication_events', keys: { clinic_id: 1, event_type: 1, created_at: -1 } },

  // --------------------------------------------------------------------- AI
  { collection: 'ai_requests', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'ai_requests', keys: { clinic_id: 1, type: 1, created_at: -1 } },
  { collection: 'ai_requests', keys: { clinic_id: 1, patient_id: 1 } },
  { collection: 'ai_requests', keys: { clinic_id: 1, user_id: 1, created_at: -1 } },
  { collection: 'ai_transcripts', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'ai_transcripts', keys: { clinic_id: 1, visit_id: 1 } },
  { collection: 'ai_transcripts', keys: { clinic_id: 1, patient_id: 1 } },

  // ------------------------------------------- observability, jobs, limits
  { collection: 'system_logs', keys: { created_at: -1 } },
  { collection: 'system_logs', keys: { clinic_id: 1, created_at: -1 } },
  { collection: 'system_logs', keys: { level: 1, created_at: -1 } },
  { collection: 'system_logs', keys: { category: 1, created_at: -1 } },
  { collection: 'background_jobs', keys: { status: 1, scheduled_at: 1 } },
  { collection: 'background_jobs', keys: { clinic_id: 1, status: 1 } },
  { collection: 'background_jobs', keys: { type: 1, created_at: -1 } },
  { collection: 'api_rate_limits', keys: { key: 1 }, options: { unique: true } },
  { collection: 'api_rate_limits', keys: { updated_at: 1 } },

  // ======================================================================
  // Global-by-id lookups. These query shapes have no clinic_id, so none of
  // the compound indexes above can serve them — they were collection scans.
  // `requireUser()` runs a profiles lookup by `id` on every authenticated
  // request; login and password reset look up by `email`; the enrichment
  // helpers batch-resolve names with `{ id: { $in: [...] } }`.
  // ======================================================================
  { collection: 'profiles', keys: { id: 1 }, options: { name: 'profiles_id' } },
  { collection: 'profiles', keys: { email: 1 }, options: { name: 'profiles_email' } },
  { collection: 'patients', keys: { id: 1 }, options: { name: 'patients_id' } },
  { collection: 'vendors', keys: { id: 1 }, options: { name: 'vendors_id' } },
  { collection: 'visits', keys: { id: 1 }, options: { name: 'visits_id' } },
  { collection: 'appointments', keys: { id: 1 }, options: { name: 'appointments_id' } },
  { collection: 'invoices', keys: { id: 1 }, options: { name: 'invoices_id' } },
  { collection: 'lab_cases', keys: { id: 1 }, options: { name: 'lab_cases_id' } },
  { collection: 'inventory_items', keys: { id: 1 }, options: { name: 'inventory_items_id' } },
  { collection: 'vendors', keys: { clinic_id: 1 }, options: { name: 'vendors_clinic' } },

  // Public share/portal tokens — unauthenticated routes look these up directly.
  { collection: 'lab_cases', keys: { public_token: 1 }, options: { name: 'lab_cases_public_token', sparse: true } },
  { collection: 'lab_cases', keys: { stl_upload_token: 1 }, options: { name: 'lab_cases_stl_upload_token', sparse: true } },
  { collection: 'invoices', keys: { share_token: 1 }, options: { name: 'invoices_share_token', sparse: true } },
  { collection: 'consent_requests', keys: { unique_token: 1 }, options: { name: 'consent_requests_unique_token', sparse: true } },

  // `documents` previously had no indexes at all. The listing query filters by
  // visit or patient within a clinic and sorts by upload time.
  { collection: 'documents', keys: { clinic_id: 1, visit_id: 1, uploaded_at: -1 } },
  { collection: 'documents', keys: { clinic_id: 1, patient_id: 1, uploaded_at: -1 } },
  { collection: 'documents', keys: { clinic_id: 1, uploaded_at: -1 } },

  // Notification bell: unread count + recent list per clinic.
  { collection: 'notifications', keys: { clinic_id: 1, read: 1, created_at: -1 } },
  { collection: 'notifications', keys: { clinic_id: 1, created_at: -1 } },

  { collection: 'consent_requests', keys: { clinic_id: 1, patient_id: 1, created_at: -1 } },
  { collection: 'consent_templates', keys: { clinic_id: 1 } },
  { collection: 'treatment_templates', keys: { clinic_id: 1 } },

  // Scheduler sweep: "messages due now" spans clinics, so it needs a
  // clinic-independent index on status + scheduled_at.
  { collection: 'messages', keys: { status: 1, scheduled_at: 1 } },
  { collection: 'communication_messages', keys: { status: 1, scheduled_at: 1 } },

  // ======================================================================
  // Retention. Only technical/ephemeral collections — clinical activity and
  // audit trails are business records and are deliberately excluded.
  // ======================================================================
  {
    collection: 'api_rate_limits',
    keys: { expires_at: 1 },
    options: { name: 'api_rate_limits_ttl', expireAfterSeconds: 0 },
  },
  {
    collection: 'login_rate_limits',
    keys: { expires_at: 1 },
    options: { name: 'login_rate_limits_ttl', expireAfterSeconds: 0 },
  },
  {
    collection: 'system_logs',
    keys: { created_at: 1 },
    options: {
      name: 'system_logs_ttl',
      expireAfterSeconds: Number(process.env.LOG_RETENTION_DAYS || 30) * DAY_SECONDS,
    },
  },
]

/**
 * Creates every index in INDEX_SPEC.
 *
 * `createIndex` is idempotent, but an existing index with the same keys under a
 * different name or TTL raises IndexOptionsConflict. Failures are collected
 * rather than thrown so one stale index cannot abort the whole run.
 *
 * `db` is optional so scripts and tests can inject a connection.
 */
export async function setupIndexes(db) {
  if (!db) db = await getDb()

  const results = await Promise.all(
    INDEX_SPEC.map(async ({ collection, keys, options = {} }) => {
      try {
        const name = await db.collection(collection).createIndex(keys, options)
        return { ok: true, collection, name }
      } catch (e) {
        return {
          ok: false,
          collection,
          name: options.name || JSON.stringify(keys),
          reason: e.codeName || e.message,
        }
      }
    })
  )

  const failed = results.filter(r => !r.ok)
  const summary = {
    total: results.length,
    created: results.length - failed.length,
    failed: failed.map(({ collection, name, reason }) => ({ collection, index: name, reason })),
  }

  if (failed.length) {
    console.warn(
      `[indexes] ${summary.created}/${summary.total} ensured; ${failed.length} skipped:`,
      summary.failed
    )
  }

  return summary
}

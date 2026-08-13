/**
 * Centralized clinic dashboard cache invalidation.
 * All mutation routes that affect dashboard metrics must call this helper.
 */

import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { invalidateAnalyticsCache, clearAnalyticsCache } from '@/lib/analytics-engine'
import { clearCommunicationCache } from '@/lib/communication-engine'
import { clearAICache } from '@/lib/ai-engine'

export const DASHBOARD_INVALIDATION_REASONS = Object.freeze([
  'appointment',
  'visit',
  'invoice',
  'patient',
  'followup',
  'lab_case',
  'inventory',
  'communication',
  'task',
])

/**
 * Invalidate clinic-scoped dashboard summaries and related engine caches.
 * Safe to call after successful mutations; never throws.
 */
export function invalidateClinicDashboard(clinicId, reason = 'unknown') {
  if (!clinicId) return { ok: false, reason: 'missing_clinic' }

  try {
    const result = invalidateDashboardCache(clinicId)
    try { invalidateAnalyticsCache(clinicId) } catch { /* noop */ }
    try { clearAnalyticsCache(clinicId) } catch { /* noop */ }
    try { clearCommunicationCache(clinicId) } catch { /* noop */ }
    try { clearAICache(clinicId) } catch { /* noop */ }
    return { ok: true, clinicId, reason, ...result }
  } catch (e) {
    console.error('invalidateClinicDashboard failed:', e?.message || e)
    return { ok: false, clinicId, reason, error: String(e?.message || e) }
  }
}

/** Backward-compatible alias */
export function invalidateDashboardRelatedCaches(clinicId, reason) {
  return invalidateClinicDashboard(clinicId, reason)
}

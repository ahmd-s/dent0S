import { MESSAGE_STATUSES, PROVIDER_OUTCOMES } from './constants.js'

export function initialStatus(scheduledAt) {
  if (scheduledAt && new Date(scheduledAt) > new Date()) {
    return MESSAGE_STATUSES.SCHEDULED
  }
  return MESSAGE_STATUSES.QUEUED
}

export function statusFromOutcome(outcome) {
  switch (outcome) {
    case PROVIDER_OUTCOMES.ACCEPTED:
      return MESSAGE_STATUSES.ACCEPTED
    case PROVIDER_OUTCOMES.ACTION_REQUIRED:
      return MESSAGE_STATUSES.ACTION_REQUIRED
    case PROVIDER_OUTCOMES.RETRYABLE_FAILURE:
      return MESSAGE_STATUSES.RETRY_SCHEDULED
    case PROVIDER_OUTCOMES.REJECTED:
    default:
      return MESSAGE_STATUSES.FAILED
  }
}

export function canMarkSent(status) {
  return status === MESSAGE_STATUSES.ACTION_REQUIRED
}

export function canCancel(status) {
  return [
    MESSAGE_STATUSES.QUEUED,
    MESSAGE_STATUSES.SCHEDULED,
    MESSAGE_STATUSES.ACTION_REQUIRED,
  ].includes(status)
}

export const NON_RETRYABLE_FAILURE_REASONS = new Set([
  'invalid_e164',
  'consent_required',
  'consent_revoked',
  'template_validation_failed',
  'cancelled',
  'whatsapp_cloud_not_configured',
  'message_body_empty',
])

export const RETRYABLE_FAILURE_REASONS = new Set([
  'timeout',
  'rate_limit',
  'server_error',
  'network_error',
])

export function isRetryableFailure(reason) {
  if (!reason) return false
  if (NON_RETRYABLE_FAILURE_REASONS.has(reason)) return false
  if (RETRYABLE_FAILURE_REASONS.has(reason)) return true
  return false
}

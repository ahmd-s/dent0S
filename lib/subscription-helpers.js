/** Razorpay billing doc on subscriptions collection */
export const TRIAL_AUTO_ENFORCEMENT = ['auto', 'paused']

/**
 * True when daily trial-expiry cron must NOT auto-block this clinic.
 * Manual admin unblock sets trial_auto_enforcement to 'paused' until explicitly re-enabled.
 */
export function isTrialAutoBlockPaused(clinic) {
  if (clinic?.subscription_exempt === true) return true
  return clinic?.trial_auto_enforcement === 'paused'
}

export function isActivePaidSubscription(sub) {
  if (!sub || sub.subscription_status !== 'active') return false
  if (!sub.current_period_end) return false
  return new Date(sub.current_period_end) > new Date()
}

export function trialEndsAtFromClinic(clinic, subscription) {
  if (clinic?.trial_ends_at) return new Date(clinic.trial_ends_at)
  // Enforcement uses clinic.trial_ends_at only — do not fall back to subscriptions.trial_end
  // (legacy trial_end is signup+14d and is often long past for pre-billing clinics).
  void subscription
  return null
}

export function trialDaysRemaining(clinic, subscription) {
  const end = trialEndsAtFromClinic(clinic, subscription)
  if (!end) return 0
  const diff = end - new Date()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function shouldShowTrialWarning(clinic, subscription) {
  if (clinic?.subscription_exempt === true) return false
  if (clinic?.subscription_status === 'blocked') return false
  if (isActivePaidSubscription(subscription)) return false
  const days = trialDaysRemaining(clinic, subscription)
  return days > 0 && days <= 3
}

export function isInGracePeriod(subscription, now = new Date()) {
  if (!subscription || subscription.subscription_status !== 'halted') return false
  if (!subscription.grace_period_end) return false
  return new Date(subscription.grace_period_end) > now
}

export function graceDaysRemaining(subscription, now = new Date()) {
  if (!isInGracePeriod(subscription, now)) return 0
  const end = new Date(subscription.grace_period_end)
  const diff = end - now
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

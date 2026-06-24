/**
 * Microsoft Clarity Custom Events Utility
 * 
 * This utility provides a type-safe interface for tracking custom events
 * using Microsoft Clarity's official API.
 * 
 * Official Clarity API: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-api
 */

/**
 * Track a custom event in Microsoft Clarity
 * @param {string} eventName - The name of the event to track
 * @param {Object} [metadata] - Optional metadata to attach to the event
 */
export function trackClarityEvent(eventName, metadata = {}) {
  if (typeof window === 'undefined') {
    return
  }

  // Check if Clarity is initialized
  if (!window.clarity) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Microsoft Clarity is not initialized. Event not tracked:', eventName)
    }
    return
  }

  try {
    // Track the event using Clarity's official API
    window.clarity('event', eventName, metadata)
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Clarity] Event tracked:', eventName, metadata)
    }
  } catch (error) {
    console.error('[Clarity] Failed to track event:', error)
  }
}

/**
 * Set a custom tag/identifier for the current session
 * @param {string} key - The tag key
 * @param {string} value - The tag value
 */
export function setClarityTag(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  if (!window.clarity) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Microsoft Clarity is not initialized. Tag not set:', key)
    }
    return
  }

  try {
    window.clarity('set', key, value)
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Clarity] Tag set:', key, value)
    }
  } catch (error) {
    console.error('[Clarity] Failed to set tag:', error)
  }
}

/**
 * Identify the current user
 * @param {string} userId - Unique user identifier
 * @param {string} [sessionId] - Optional session identifier
 */
export function identifyClarityUser(userId, sessionId) {
  if (typeof window === 'undefined') {
    return
  }

  if (!window.clarity) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Microsoft Clarity is not initialized. User not identified:', userId)
    }
    return
  }

  try {
    window.clarity('identify', userId, sessionId, null, null)
    
    if (process.env.NODE_ENV === 'development') {
      console.log('[Clarity] User identified:', userId)
    }
  } catch (error) {
    console.error('[Clarity] Failed to identify user:', error)
  }
}

// Pre-defined event constants for consistency across the application
export const CLARITY_EVENTS = {
  LANDING_PAGE_VIEWED: 'landing_page_viewed',
  PRICING_VIEWED: 'pricing_viewed',
  START_FREE_TRIAL_CLICKED: 'start_free_trial_clicked',
  SIGNUP_COMPLETED: 'signup_completed',
  CLINIC_CREATED: 'clinic_created',
  SUBSCRIPTION_PURCHASED: 'subscription_purchased',
  BILLING_PAGE_VIEWED: 'billing_page_viewed',
}

// Convenience functions for pre-defined events
export function trackLandingPageViewed(metadata = {}) {
  trackClarityEvent(CLARITY_EVENTS.LANDING_PAGE_VIEWED, metadata)
}

export function trackPricingViewed(metadata = {}) {
  trackClarityEvent(CLARITY_EVENTS.PRICING_VIEWED, metadata)
}

export function trackStartFreeTrialClicked(metadata = {}) {
  trackClarityEvent(CLARITY_EVENTS.START_FREE_TRIAL_CLICKED, metadata)
}

export function trackSignupCompleted(metadata = {}) {
  trackClarityEvent(CLARITY_EVENTS.SIGNUP_COMPLETED, metadata)
}

export function trackClinicCreated(metadata = {}) {
  trackClarityEvent(CLARITY_EVENTS.CLINIC_CREATED, metadata)
}

export function trackSubscriptionPurchased(metadata = {}) {
  trackClarityEvent(CLARITY_EVENTS.SUBSCRIPTION_PURCHASED, metadata)
}

export function trackBillingPageViewed(metadata = {}) {
  trackClarityEvent(CLARITY_EVENTS.BILLING_PAGE_VIEWED, metadata)
}

/**
 * Sprint 20 — Shared UI class tokens for consistent polish across DentOS.
 * Use these in new/refactored components; existing hex usage remains backward compatible.
 */

/** Primary CTA button — maps to design token */
export const BTN_PRIMARY = 'bg-primary hover:bg-primary/90 text-primary-foreground'

/** Legacy teal — matches existing hardcoded buttons */
export const BTN_PRIMARY_LEGACY = 'bg-[#0D9488] hover:bg-[#0B7E73] text-white'

/** Standard card surface */
export const CARD_SURFACE = 'bg-card border border-border rounded-lg shadow-sm'

/** Page content max width */
export const PAGE_CONTAINER = 'max-w-7xl mx-auto'

/** Settings sub-page container */
export const SETTINGS_CONTAINER = 'max-w-5xl mx-auto'

/** Touch-friendly minimum height */
export const TOUCH_TARGET = 'min-h-[44px] touch-manipulation'

/** Focus ring for interactive elements */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/** Semantic status surfaces — color only when the state needs attention. */

export const STATUS_TONE = {
  muted: 'text-muted-foreground bg-muted/70',
  info: 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/30',
  warning: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/30',
  success: 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950/30',
  critical: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/30',
}

export const STATUS_TEXT = {
  muted: 'text-muted-foreground',
  info: 'text-blue-700 dark:text-blue-300',
  warning: 'text-amber-700 dark:text-amber-300',
  success: 'text-green-700 dark:text-green-300',
  critical: 'text-red-600 dark:text-red-400',
}

const SEMANTIC_HEX = /#(EF4444|F59E0B|22C55E|16A34A|DC2626|D97706|F97316|0EA5E9|2563EB)/i

export function isAlertValue(val) {
  if (val == null || val === '—' || val === '') return false
  if (typeof val === 'number') return val > 0
  const n = parseFloat(String(val).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n > 0 : true
}

/** Keep color only for warning/success/critical; drop decorative palette. */
export function semanticStatColor(color, val) {
  if (!color || !SEMANTIC_HEX.test(String(color))) return undefined
  if (!isAlertValue(val) && /EF4444|F59E0B|DC2626|D97706|F97316/i.test(String(color))) return undefined
  return color
}

export function statusChipClass(tone = 'muted') {
  return `inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[tone] || STATUS_TONE.muted}`
}

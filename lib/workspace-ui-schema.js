/**
 * UI field definitions for the Workspace Builder.
 * Keys align with lib/workspace-engine.js DEFAULT_ROLE_TEMPLATES.
 */

export const ROLE_LABELS = {
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
}

/** Navigation keys that cannot be disabled. */
export const LOCKED_NAV_KEYS = ['dashboard', 'patients']

export const EDITOR_TABS = [
  { id: 'navigation', label: 'Navigation' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'patient_page', label: 'Patient Page' },
  { id: 'quick_actions', label: 'Quick Actions' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'layout', label: 'Layout' },
]

export const NAVIGATION_FIELDS = [
  { key: 'dashboard', label: 'Dashboard', locked: true },
  { key: 'patients', label: 'Patients', locked: true },
  { key: 'appointments', label: 'Appointments' },
  { key: 'visits', label: 'Visits' },
  { key: 'billing', label: 'Billing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'labs', label: 'Lab' },
  { key: 'reports', label: 'Reports' },
  { key: 'ai', label: 'AI' },
  { key: 'vendors', label: 'Vendors' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'settings', label: 'Settings' },
  { key: 'subscription', label: 'Subscription' },
]

export const DASHBOARD_FIELDS = [
  { key: 'queue', label: "Today's Queue" },
  { key: 'todays_patients', label: "Today's Patients" },
  { key: 'calendar', label: 'Calendar' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'pending_bills', label: 'Pending Bills' },
  { key: 'followups', label: 'Follow Ups' },
  { key: 'recent_patients', label: 'Recent Patients' },
  { key: 'ai_summary', label: 'AI Summary' },
  { key: 'inventory_alerts', label: 'Inventory Alerts' },
  { key: 'lab_cases', label: 'Lab Cases' },
  { key: 'broadcast', label: 'Broadcast' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'upcoming_appointments', label: 'Upcoming Appointments' },
]

export const PATIENT_PAGE_FIELDS = [
  { key: 'basic_info', label: 'Basic Information' },
  { key: 'medical_history', label: 'Medical History' },
  { key: 'clinical_notes', label: 'Clinical Notes' },
  { key: 'prescriptions', label: 'Prescriptions' },
  { key: 'treatment_history', label: 'Treatment History' },
  { key: 'tooth_chart', label: 'Tooth Chart' },
  { key: 'lab_reports', label: 'Lab Reports' },
  { key: 'xrays', label: 'X-rays' },
  { key: 'documents', label: 'Documents' },
  { key: 'billing', label: 'Billing' },
  { key: 'payments', label: 'Payments' },
  { key: 'internal_remarks', label: 'Internal Remarks' },
]

export const QUICK_ACTION_FIELDS = [
  { key: 'new_patient', label: 'New Patient' },
  { key: 'new_appointment', label: 'New Appointment' },
  { key: 'new_visit', label: 'New Visit' },
  { key: 'generate_invoice', label: 'Generate Invoice' },
  { key: 'collect_payment', label: 'Collect Payment' },
  { key: 'upload_xray', label: 'Upload X-ray' },
  { key: 'generate_ai_summary', label: 'Generate AI Summary' },
  { key: 'new_lab_case', label: 'Create Lab Case' },
  { key: 'print_prescription', label: 'Print Prescription' },
]

export const DEFAULT_WIDGET_ORDER = DASHBOARD_FIELDS.map(f => f.key)

export const LAYOUT_DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'expanded', label: 'Expanded' },
]

export const LAYOUT_VIEW_OPTIONS = [
  { value: 'cards', label: 'Cards' },
  { value: 'list', label: 'List' },
  { value: 'two-column', label: 'Two-column' },
]

export const WIDGET_LABELS = Object.fromEntries(DASHBOARD_FIELDS.map(f => [f.key, f.label]))

/**
 * Client-side validation before save (mirrors engine rules).
 */
export function validateRoleConfigForSave(config) {
  if (!config?.navigation) {
    return { ok: false, error: 'Navigation configuration is required' }
  }
  if (config.navigation.dashboard !== true) {
    return { ok: false, error: 'Dashboard must remain enabled in navigation' }
  }
  if (config.navigation.patients !== true) {
    return { ok: false, error: 'Patients must remain enabled in navigation' }
  }

  const density = config.layout?.density
  if (density && !LAYOUT_DENSITY_OPTIONS.some(o => o.value === density)) {
    return { ok: false, error: 'Invalid layout density' }
  }

  const viewMode = config.layout?.view_mode
  if (viewMode && !LAYOUT_VIEW_OPTIONS.some(o => o.value === viewMode)) {
    return { ok: false, error: 'Invalid layout view mode' }
  }

  const order = config.layout?.widget_order
  if (order && (!Array.isArray(order) || order.some(k => typeof k !== 'string'))) {
    return { ok: false, error: 'Widget order must be a list of widget keys' }
  }

  return { ok: true }
}

export function deepCloneRoleConfig(config) {
  return JSON.parse(JSON.stringify(config))
}

export function configsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function normalizeWidgetOrder(order) {
  const base = Array.isArray(order) ? [...order] : []
  const seen = new Set(base)
  for (const key of DEFAULT_WIDGET_ORDER) {
    if (!seen.has(key)) base.push(key)
  }
  return base.filter(k => DEFAULT_WIDGET_ORDER.includes(k))
}

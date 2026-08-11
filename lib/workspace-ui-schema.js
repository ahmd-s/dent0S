/**
 * UI field definitions for the Role Experience / Workspace Builder.
 * Keys align with lib/workspace-engine.js and workspace-template-defaults.js.
 */

export const ROLE_LABELS = {
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
}

/** Navigation keys that cannot be disabled. */
export const LOCKED_NAV_KEYS = ['dashboard', 'patients']

export const PATIENT_ACCESS_MODES = ['hidden', 'readonly', 'editable']

export const PATIENT_ACCESS_LABELS = {
  hidden: 'Hidden',
  readonly: 'Read Only',
  editable: 'Editable',
}

export const DASHBOARD_WIDGET_SIZES = ['small', 'medium', 'large', 'full']

export const DASHBOARD_SIZE_LABELS = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  full: 'Full width',
}

export const EDITOR_TABS = [
  { id: 'navigation', label: 'Sidebar' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'patient_page', label: 'Patient Page' },
  { id: 'actions', label: 'Actions' },
  { id: 'quick_actions', label: 'Quick Actions' },
  { id: 'homepage', label: 'Homepage' },
  { id: 'presets', label: 'Presets' },
  { id: 'preview', label: 'Live Preview' },
  { id: 'layout', label: 'Layout' },
]

/** Primary sidebar items — unique routes only. */
export const NAVIGATION_FIELDS = [
  { key: 'dashboard', label: 'Dashboard', locked: true },
  { key: 'patients', label: 'Patients', locked: true },
  { key: 'appointments', label: 'Appointments' },
  { key: 'billing', label: 'Billing' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'labs', label: 'Lab Cases' },
  { key: 'reports', label: 'Reports' },
  { key: 'settings', label: 'Settings' },
  { key: 'subscription', label: 'Subscription' },
]

export const DEFAULT_NAV_ORDER = NAVIGATION_FIELDS.map(f => f.key)

/** Sprint 9 dashboard widgets — only existing widgets are rendered live. */
export const DASHBOARD_FIELDS = [
  { key: 'queue', label: "Today's Queue" },
  { key: 'upcoming_appointments', label: "Today's Appointments" },
  { key: 'todays_patients', label: "Today's Patients" },
  { key: 'revenue', label: 'Revenue' },
  { key: 'pending_bills', label: 'Pending Payments' },
  { key: 'lab_cases', label: 'Pending Lab Cases' },
  { key: 'inventory_alerts', label: 'Inventory Alerts' },
  { key: 'ai_summary', label: 'AI Summary' },
  { key: 'followups', label: 'Follow Ups' },
  { key: 'birthdays', label: 'Birthdays' },
  { key: 'quick_notes', label: 'Quick Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'recent_activity', label: 'Recent Activity' },
]

export const DEFAULT_WIDGET_ORDER = DASHBOARD_FIELDS.map(f => f.key)

/** Patient page sections for Role Experience builder. */
export const PATIENT_PAGE_FIELDS = [
  { key: 'basic_info', label: 'Profile' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'visits', label: 'Visits' },
  { key: 'treatment_history', label: 'Treatment Plan' },
  { key: 'clinical_notes', label: 'Clinical Notes' },
  { key: 'medical_history', label: 'Medical History' },
  { key: 'tooth_chart', label: 'Tooth Chart' },
  { key: 'lab_reports', label: 'Lab' },
  { key: 'documents', label: 'Documents' },
  { key: 'billing', label: 'Billing' },
  { key: 'consents', label: 'Consent' },
  { key: 'ai_summary', label: 'AI' },
  { key: 'prescriptions', label: 'Prescription' },
  { key: 'followups', label: 'Follow Ups' },
  { key: 'payments', label: 'Payments' },
  { key: 'internal_remarks', label: 'Internal Remarks' },
  { key: 'xrays', label: 'X-rays' },
]

export const QUICK_ACTION_FIELDS = [
  { key: 'new_patient', label: 'Register Patient' },
  { key: 'new_appointment', label: 'Book Appointment' },
  { key: 'new_visit', label: 'New Visit' },
  { key: 'print_prescription', label: 'Prescription' },
  { key: 'upload_xray', label: 'Upload X-ray' },
  { key: 'new_lab_case', label: 'Lab Order' },
  { key: 'collect_payment', label: 'Collect Payment' },
  { key: 'generate_invoice', label: 'Print Invoice' },
  { key: 'whatsapp_reminder', label: 'WhatsApp Reminder' },
  { key: 'generate_ai_summary', label: 'Voice Note / AI Summary' },
  { key: 'new_invoice', label: 'New Invoice' },
]

export const DEFAULT_QUICK_ACTION_ORDER = QUICK_ACTION_FIELDS.map(f => f.key)

export const APPOINTMENT_ACTION_FIELDS = [
  { key: 'view', label: 'View', permission: 'view_appointment' },
  { key: 'create', label: 'Create', permission: 'create_appointment' },
  { key: 'edit', label: 'Edit', permission: 'edit_appointment' },
  { key: 'cancel', label: 'Cancel', permission: 'cancel_appointment' },
  { key: 'reschedule', label: 'Reschedule', permission: 'edit_appointment' },
  { key: 'mark_arrived', label: 'Mark Arrived', permission: 'edit_appointment' },
  { key: 'complete', label: 'Complete', permission: 'edit_appointment' },
]

export const BILLING_ACTION_FIELDS = [
  { key: 'view', label: 'View', permission: 'view_billing' },
  { key: 'create', label: 'Create', permission: 'create_invoice' },
  { key: 'edit', label: 'Edit', permission: 'edit_invoice' },
  { key: 'delete', label: 'Delete', permission: 'delete_invoice' },
  { key: 'mark_paid', label: 'Mark Paid', permission: 'edit_invoice' },
  { key: 'discount', label: 'Discount', permission: 'edit_invoice' },
  { key: 'share', label: 'Share', permission: 'view_billing' },
  { key: 'export', label: 'Export', permission: 'export_reports' },
]

export const PATIENT_ACTION_FIELDS = [
  { key: 'view', label: 'View', permission: 'view_patient' },
  { key: 'create', label: 'Create', permission: 'create_patient' },
  { key: 'edit', label: 'Edit', permission: 'edit_patient' },
  { key: 'delete', label: 'Delete', permission: 'delete_patient' },
  { key: 'merge', label: 'Merge', permission: 'edit_patient' },
  { key: 'archive', label: 'Archive', permission: 'edit_patient' },
  { key: 'restore', label: 'Restore', permission: 'edit_patient' },
  { key: 'import', label: 'Import', permission: 'create_patient' },
  { key: 'export', label: 'Export', permission: 'export_patient' },
]

export const ACTION_MODULE_TABS = [
  { id: 'appointments', label: 'Appointments', fields: APPOINTMENT_ACTION_FIELDS, section: 'appointment_page' },
  { id: 'billing', label: 'Billing', fields: BILLING_ACTION_FIELDS, section: 'billing_page' },
  { id: 'patients', label: 'Patients', fields: PATIENT_ACTION_FIELDS, section: 'permissions' },
]

export const HOMEPAGE_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { value: 'appointments', label: 'Appointments', href: '/appointments' },
  { value: 'patients', label: 'Patients', href: '/patients' },
  { value: 'queue', label: 'Queue', href: '/dashboard' },
]

export const RESET_SECTIONS = [
  { id: 'dashboard', label: 'Reset Dashboard' },
  { id: 'sidebar', label: 'Reset Sidebar' },
  { id: 'patient_page', label: 'Reset Patient Page' },
  { id: 'actions', label: 'Reset Actions' },
  { id: 'all', label: 'Reset Entire Workspace' },
]

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

export function normalizeWidgetOrder(order) {
  const base = Array.isArray(order) ? [...order] : []
  const seen = new Set(base)
  for (const key of DEFAULT_WIDGET_ORDER) {
    if (!seen.has(key)) base.push(key)
  }
  return base.filter(k => DEFAULT_WIDGET_ORDER.includes(k))
}

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

  if (config.homepage?.landing) {
    const valid = HOMEPAGE_OPTIONS.some(o => o.value === config.homepage.landing)
    if (!valid) return { ok: false, error: 'Invalid homepage landing page' }
  }

  return { ok: true }
}

export function deepCloneRoleConfig(config) {
  return JSON.parse(JSON.stringify(config))
}

export function configsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function deepCloneWorkspace(ws) {
  return JSON.parse(JSON.stringify(ws))
}

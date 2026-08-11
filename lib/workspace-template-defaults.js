/**
 * Default role templates for the workspace / role experience engine.
 */

import {
  DEFAULT_WIDGET_ORDER,
  DEFAULT_NAV_ORDER,
  DEFAULT_QUICK_ACTION_ORDER,
} from '@/lib/workspace-ui-schema'
import { PATIENT_ACCESS, getDefaultHomepageForRole } from '@/lib/workspace-role-experience'

const BASE_NAV = {
  dashboard: true,
  patients: true,
  appointments: true,
  billing: true,
  inventory: true,
  labs: true,
  reports: true,
  settings: true,
  subscription: true,
}

const BASE_DASHBOARD = {
  queue: true,
  upcoming_appointments: true,
  todays_patients: true,
  revenue: true,
  pending_bills: true,
  followups: true,
  lab_cases: true,
  inventory_alerts: true,
  ai_summary: true,
  birthdays: false,
  quick_notes: false,
  tasks: true,
  recent_activity: true,
}

const BASE_PATIENT_PAGE = {
  basic_info: PATIENT_ACCESS.EDITABLE,
  timeline: PATIENT_ACCESS.EDITABLE,
  visits: PATIENT_ACCESS.EDITABLE,
  treatment_history: PATIENT_ACCESS.EDITABLE,
  clinical_notes: PATIENT_ACCESS.EDITABLE,
  medical_history: PATIENT_ACCESS.EDITABLE,
  tooth_chart: PATIENT_ACCESS.EDITABLE,
  lab_reports: PATIENT_ACCESS.EDITABLE,
  documents: PATIENT_ACCESS.EDITABLE,
  billing: PATIENT_ACCESS.EDITABLE,
  consents: PATIENT_ACCESS.EDITABLE,
  ai_summary: PATIENT_ACCESS.EDITABLE,
  prescriptions: PATIENT_ACCESS.EDITABLE,
  followups: PATIENT_ACCESS.EDITABLE,
  payments: PATIENT_ACCESS.EDITABLE,
  internal_remarks: PATIENT_ACCESS.EDITABLE,
  xrays: PATIENT_ACCESS.EDITABLE,
}

const BASE_APPOINTMENT_PAGE = {
  view: true,
  create: true,
  edit: true,
  cancel: true,
  reschedule: true,
  mark_arrived: true,
  complete: true,
  assign_doctor: true,
  notes: true,
  reminders: true,
  calendar_day: true,
  calendar_week: true,
  calendar_month: true,
  calendar_doctor: true,
  calendar_chair: true,
  calendar_queue: true,
}

const BASE_BILLING_PAGE = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  mark_paid: true,
  discount: true,
  share: true,
  export: true,
  create_invoice: true,
  edit_invoice: true,
  payments: true,
  discounts: true,
}

const BASE_INVENTORY_PAGE = {
  view: true,
  add_item: true,
  adjust_stock: true,
  vendors: true,
  alerts: true,
}

const BASE_LAB_PAGE = {
  create_case: true,
  track_status: true,
  vendors: true,
}

const BASE_REPORTS_PAGE = {
  revenue: true,
  patients: true,
  appointments: true,
  inventory: true,
  export: true,
}

const BASE_QUICK_ACTIONS = {
  new_patient: true,
  new_appointment: true,
  new_visit: true,
  print_prescription: true,
  upload_xray: true,
  new_lab_case: true,
  collect_payment: true,
  generate_invoice: true,
  whatsapp_reminder: false,
  generate_ai_summary: true,
  new_invoice: true,
}

function widgetFlags(enabled = true) {
  const out = {}
  for (const key of DEFAULT_WIDGET_ORDER) out[key] = enabled
  out.stats_cards = enabled
  out.ai_insights = enabled
  return out
}

function baseLayout(role = 'admin') {
  const widgetMeta = {}
  DEFAULT_WIDGET_ORDER.forEach((key, i) => {
    widgetMeta[key] = { size: 'medium', collapsed: false, refresh_priority: i + 1 }
  })
  const navMeta = {}
  DEFAULT_NAV_ORDER.forEach(key => {
    navMeta[key] = { badge_enabled: false }
  })
  return {
    density: 'comfortable',
    view_mode: 'cards',
    widget_order: [...DEFAULT_WIDGET_ORDER],
    nav_order: [...DEFAULT_NAV_ORDER],
    quick_action_order: [...DEFAULT_QUICK_ACTION_ORDER],
    primary_quick_action: role === 'receptionist' ? 'new_appointment' : 'new_patient',
    widget_meta: widgetMeta,
    nav_meta: navMeta,
    sidebar_collapsed: false,
    compact_mode: false,
  }
}

function basePermissions(full = true) {
  return {
    view_patient: full,
    create_patient: full,
    edit_patient: full,
    delete_patient: full,
    export_patient: full,
    view_appointment: full,
    create_appointment: full,
    edit_appointment: full,
    cancel_appointment: full,
    view_billing: full,
    create_invoice: full,
    edit_invoice: full,
    delete_invoice: full,
    manage_inventory: full,
    manage_staff: full,
    manage_settings: full,
    export_reports: full,
  }
}

function baseHomepage(role) {
  return { landing: getDefaultHomepageForRole(role) }
}

function buildRole(role, overrides = {}) {
  const permissionsFull = overrides.permissionsFull !== false
  return {
    navigation: { ...BASE_NAV, ...(overrides.navigation || {}) },
    dashboard: { ...BASE_DASHBOARD, ...(overrides.dashboard || {}) },
    patient_page: { ...BASE_PATIENT_PAGE, ...(overrides.patient_page || {}) },
    appointment_page: { ...BASE_APPOINTMENT_PAGE, ...(overrides.appointment_page || {}) },
    billing_page: { ...BASE_BILLING_PAGE, ...(overrides.billing_page || {}) },
    inventory_page: { ...BASE_INVENTORY_PAGE, ...(overrides.inventory_page || {}) },
    lab_page: { ...BASE_LAB_PAGE, ...(overrides.lab_page || {}) },
    reports_page: { ...BASE_REPORTS_PAGE, ...(overrides.reports_page || {}) },
    quick_actions: { ...BASE_QUICK_ACTIONS, ...(overrides.quick_actions || {}) },
    widgets: {
      ...widgetFlags(overrides.widgetsEnabled !== false),
      ...(overrides.widgets || {}),
    },
    permissions: {
      ...basePermissions(permissionsFull),
      ...(overrides.permissions || {}),
    },
    layout: { ...baseLayout(role), ...(overrides.layout || {}) },
    homepage: { ...baseHomepage(role), ...(overrides.homepage || {}) },
  }
}

export const DEFAULT_ROLE_TEMPLATES = {
  admin: buildRole('admin'),

  doctor: buildRole('doctor', {
    navigation: {
      billing: false,
      settings: false,
      subscription: false,
    },
    dashboard: {
      revenue: false,
      pending_bills: false,
    },
    patient_page: {
      billing: PATIENT_ACCESS.HIDDEN,
      payments: PATIENT_ACCESS.HIDDEN,
      internal_remarks: PATIENT_ACCESS.HIDDEN,
    },
    appointment_page: {
      assign_doctor: false,
      reminders: false,
    },
    billing_page: {
      create: false,
      edit: false,
      delete: false,
      mark_paid: false,
      discount: false,
      export: false,
      create_invoice: false,
      edit_invoice: false,
      payments: false,
      discounts: false,
    },
    inventory_page: { vendors: false },
    lab_page: { vendors: false },
    reports_page: {
      revenue: false,
      inventory: false,
      export: false,
    },
    quick_actions: {
      generate_invoice: false,
      collect_payment: false,
      generate_ai_summary: false,
      new_invoice: false,
    },
    widgets: {
      revenue: false,
      pending_bills: false,
    },
    permissionsFull: false,
    permissions: {
      delete_patient: false,
      export_patient: false,
      create_invoice: false,
      edit_invoice: false,
      delete_invoice: false,
      manage_staff: false,
      manage_settings: false,
      export_reports: false,
    },
  }),

  receptionist: buildRole('receptionist', {
    navigation: {
      reports: false,
      settings: false,
      subscription: false,
    },
    dashboard: {
      ai_summary: false,
      revenue: false,
      pending_bills: false,
    },
    patient_page: {
      medical_history: PATIENT_ACCESS.HIDDEN,
      clinical_notes: PATIENT_ACCESS.HIDDEN,
      prescriptions: PATIENT_ACCESS.HIDDEN,
      treatment_history: PATIENT_ACCESS.HIDDEN,
      tooth_chart: PATIENT_ACCESS.HIDDEN,
      lab_reports: PATIENT_ACCESS.HIDDEN,
      xrays: PATIENT_ACCESS.HIDDEN,
      internal_remarks: PATIENT_ACCESS.HIDDEN,
      visits: PATIENT_ACCESS.HIDDEN,
      consents: PATIENT_ACCESS.READONLY,
      ai_summary: PATIENT_ACCESS.HIDDEN,
    },
    appointment_page: { notes: false },
    billing_page: { export: false },
    lab_page: { vendors: false },
    reports_page: {
      revenue: false,
      patients: false,
      appointments: false,
      inventory: false,
      export: false,
    },
    quick_actions: {
      new_visit: false,
      upload_xray: false,
      generate_ai_summary: false,
      print_prescription: false,
    },
    widgets: {
      ai_summary: false,
      ai_insights: false,
    },
    homepage: { landing: 'appointments' },
    permissionsFull: false,
    permissions: {
      delete_patient: false,
      export_patient: false,
      delete_invoice: false,
      manage_staff: false,
      manage_settings: false,
      export_reports: false,
    },
  }),
}

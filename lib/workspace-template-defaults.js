/**
 * Default role templates for the workspace engine.
 * Extended for Workspace Builder UI (Sprint 6).
 */

import { DEFAULT_WIDGET_ORDER } from '@/lib/workspace-ui-schema'

const BASE_NAV = {
  dashboard: true,
  patients: true,
  appointments: true,
  visits: true,
  billing: true,
  inventory: true,
  labs: true,
  reports: true,
  ai: false,
  vendors: true,
  marketing: false,
  settings: true,
  subscription: true,
}

const BASE_DASHBOARD = {
  queue: true,
  todays_patients: true,
  calendar: true,
  revenue: true,
  pending_bills: true,
  followups: true,
  recent_patients: true,
  ai_summary: true,
  inventory_alerts: true,
  lab_cases: true,
  broadcast: false,
  notifications: true,
  upcoming_appointments: true,
  pending_labs: true,
}

const BASE_PATIENT_PAGE = {
  basic_info: true,
  medical_history: true,
  clinical_notes: true,
  prescriptions: true,
  treatment_history: true,
  tooth_chart: true,
  lab_reports: true,
  xrays: true,
  documents: true,
  billing: true,
  payments: true,
  internal_remarks: true,
  visits: true,
  consents: true,
}

const BASE_APPOINTMENT_PAGE = {
  create: true,
  edit: true,
  cancel: true,
  reschedule: true,
  assign_doctor: true,
  notes: true,
  reminders: true,
}

const BASE_BILLING_PAGE = {
  create_invoice: true,
  edit_invoice: true,
  payments: true,
  discounts: true,
  export: true,
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
  generate_invoice: true,
  collect_payment: true,
  upload_xray: true,
  generate_ai_summary: true,
  new_lab_case: true,
  print_prescription: true,
  new_invoice: true,
}

function widgetFlags(enabled = true) {
  const out = {}
  for (const key of DEFAULT_WIDGET_ORDER) out[key] = enabled
  out.stats_cards = enabled
  out.recent_activity = enabled
  out.ai_insights = enabled
  return out
}

function baseLayout() {
  return {
    density: 'comfortable',
    view_mode: 'cards',
    widget_order: [...DEFAULT_WIDGET_ORDER],
    sidebar_collapsed: false,
    compact_mode: false,
  }
}

function basePermissions(full = true) {
  return {
    create_patient: full,
    edit_patient: full,
    delete_patient: full,
    export_patient: full,
    create_appointment: full,
    edit_appointment: full,
    cancel_appointment: full,
    create_invoice: full,
    edit_invoice: full,
    delete_invoice: full,
    manage_inventory: full,
    manage_staff: full,
    manage_settings: full,
    export_reports: full,
  }
}

function buildRole(overrides = {}) {
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
    layout: { ...baseLayout(), ...(overrides.layout || {}) },
  }
}

export const DEFAULT_ROLE_TEMPLATES = {
  admin: buildRole(),

  doctor: buildRole({
    navigation: {
      billing: false,
      ai: false,
      marketing: false,
      settings: false,
      subscription: false,
    },
    dashboard: {
      revenue: false,
      pending_bills: false,
      broadcast: false,
    },
    patient_page: {
      billing: false,
      payments: false,
      internal_remarks: false,
    },
    appointment_page: {
      assign_doctor: false,
      reminders: false,
    },
    billing_page: {
      create_invoice: false,
      edit_invoice: false,
      payments: false,
      discounts: false,
      export: false,
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
      broadcast: false,
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

  receptionist: buildRole({
    navigation: {
      reports: false,
      ai: false,
      marketing: false,
      settings: false,
      subscription: false,
    },
    dashboard: {
      ai_summary: false,
      revenue: false,
      pending_bills: false,
      broadcast: false,
    },
    patient_page: {
      medical_history: false,
      clinical_notes: false,
      prescriptions: false,
      treatment_history: false,
      tooth_chart: false,
      lab_reports: false,
      xrays: false,
      internal_remarks: false,
      visits: false,
      consents: false,
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
      revenue: false,
      ai_insights: false,
    },
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

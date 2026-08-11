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
  business: false,
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
  // Sprint 13 flow widgets (off by default — enable via Workspace Builder)
  todays_queue: false,
  chair_status: false,
  current_treatments: false,
  waiting_patients: false,
  emergency_queue: false,
  doctor_load: false,
  average_wait: false,
  appointments_today: false,
  completed_today: false,
  cancelled_today: false,
  no_shows: false,
  revenue_today: false,
  chair_utilization: false,
  doctor_utilization: false,
  queue_health: false,
  // Sprint 14 lab widgets (off by default)
  lab_queue: false,
  cases_due_today: false,
  delayed_cases: false,
  vendor_performance: false,
  awaiting_dispatch: false,
  awaiting_installation: false,
  average_turnaround: false,
  open_cases: false,
  completed_this_week: false,
  // Sprint 15 inventory widgets (off by default)
  inventory_value: false,
  low_stock: false,
  critical_stock: false,
  expiring_soon: false,
  todays_consumption: false,
  top_consumed: false,
  purchase_requests: false,
  vendor_alerts: false,
  stock_movement: false,
  monthly_spend: false,
  inventory_health: false,
  // Sprint 16 BI widgets (off by default)
  revenue_trend: false,
  patient_growth: false,
  appointment_trend: false,
  todays_collections: false,
  doctor_leaderboard: false,
  business_health: false,
  bi_inventory_health: false,
  lab_health: false,
  forecast: false,
  top_treatments: false,
  collection_due: false,
  retention: false,
  // Sprint 17 communication widgets (off by default)
  comm_todays_reminders: false,
  comm_birthdays: false,
  comm_pending_followups: false,
  comm_activity: false,
  comm_campaign_performance: false,
  comm_review_requests: false,
  comm_outstanding_payments: false,
  comm_lab_notifications: false,
  comm_appointment_reminders: false,
  comm_messages_sent: false,
  // Sprint 18 AI widgets (off by default)
  ai_doctor_brief: false,
  ai_clinical_alerts: false,
  ai_pending_drafts: false,
  ai_business_insights: false,
  ai_voice_queue: false,
  ai_lab_insights: false,
  ai_inventory_insights: false,
  ai_patient_risk: false,
  ai_treatment_suggestions: false,
  ai_automation_queue: false,
  // Sprint 19 — system health widget (off by default)
  system_health: false,
}

const BASE_LAB_OS_PAGE = {
  lab_dashboard: true,
  doctor_lab_dashboard: true,
  reception_lab_dashboard: true,
  vendor_panel: true,
  lab_timeline: true,
  delivery_cards: true,
  lab_statistics: true,
  quick_actions: true,
  compact_mode: false,
}

const BASE_INVENTORY_OS_PAGE = {
  inventory_dashboard: true,
  doctor_inventory_dashboard: true,
  reception_inventory_dashboard: true,
  purchase_panel: true,
  stock_alerts: true,
  inventory_statistics: true,
  inventory_cards: true,
  quick_actions: true,
  compact_mode: false,
}

const BASE_COMMUNICATION_OS_PAGE = {
  communication_dashboard: true,
  campaign_center: true,
  review_panel: true,
  reminder_center: true,
  communication_timeline: true,
  patient_segments: true,
  quick_actions: true,
  compact_mode: false,
}

const BASE_AI_OS_PAGE = {
  ai_dashboard: true,
  doctor_copilot: true,
  clinical_assistant: true,
  voice_assistant: true,
  prescription_assistant: true,
  patient_education: true,
  recall_intelligence: true,
  automation_panel: true,
  quick_actions: true,
  compact_mode: false,
}

const BASE_FLOW_PAGE = {
  reception_dashboard: true,
  doctor_dashboard: true,
  chair_board: true,
  queue_board: true,
  waiting_timer: true,
  flow_statistics: true,
  quick_actions: true,
  compact_mode: false,
  card_density: true,
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
  appointment_flow: PATIENT_ACCESS.EDITABLE,
  inventory_usage: PATIENT_ACCESS.READONLY,
  communication: PATIENT_ACCESS.EDITABLE,
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
  purchases: true,
  batches: true,
  consumption_rules: true,
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
    flow_page: { ...BASE_FLOW_PAGE, ...(overrides.flow_page || {}) },
    lab_os_page: { ...BASE_LAB_OS_PAGE, ...(overrides.lab_os_page || {}) },
    inventory_os_page: { ...BASE_INVENTORY_OS_PAGE, ...(overrides.inventory_os_page || {}) },
    communication_os_page: { ...BASE_COMMUNICATION_OS_PAGE, ...(overrides.communication_os_page || {}) },
    ai_os_page: { ...BASE_AI_OS_PAGE, ...(overrides.ai_os_page || {}) },
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
  admin: buildRole('admin', {
    navigation: {
      business: true,
      marketing: true,
      ai: true,
    },
    dashboard: {
      business_health: true,
      revenue_trend: true,
      patient_growth: true,
      forecast: true,
      comm_todays_reminders: true,
      comm_activity: true,
      ai_summary: true,
      ai_doctor_brief: true,
      ai_clinical_alerts: true,
    },
  }),

  doctor: buildRole('doctor', {
    navigation: {
      billing: false,
      settings: false,
      subscription: false,
    },
    dashboard: {
      revenue: false,
      pending_bills: false,
      current_treatments: true,
      completed_today: true,
      doctor_utilization: true,
      lab_queue: true,
      delayed_cases: true,
      open_cases: true,
    },
    flow_page: {
      doctor_dashboard: true,
      queue_board: true,
      reception_dashboard: false,
      chair_board: false,
    },
    lab_os_page: {
      doctor_lab_dashboard: true,
      lab_dashboard: true,
      reception_lab_dashboard: false,
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
      todays_queue: true,
      waiting_patients: true,
      chair_status: true,
      appointments_today: true,
      queue_health: true,
      lab_queue: true,
      cases_due_today: true,
      awaiting_dispatch: true,
      delayed_cases: true,
    },
    flow_page: {
      reception_dashboard: true,
      chair_board: true,
      queue_board: true,
      waiting_timer: true,
      quick_actions: true,
      doctor_dashboard: false,
    },
    lab_os_page: {
      reception_lab_dashboard: true,
      lab_dashboard: true,
      delivery_cards: true,
      doctor_lab_dashboard: false,
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

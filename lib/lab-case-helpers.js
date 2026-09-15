/** Canonical workflow statuses in order. */
export const LAB_WORKFLOW_STATUSES = [
  'pending',
  'impression_ready',
  'sent',
  'lab_received',
  'in_production',
  'quality_check',
  'ready',
  'delivered',
  'installed',
  'completed',
  'cancelled',
]

/** Legacy aliases normalized to canonical values. */
const LEGACY_STATUS_MAP = {
  in_progress: 'in_production',
  received: 'delivered',
  ready_for_dispatch: 'ready',
  manufacturing: 'in_production',
  qc: 'quality_check',
  created: 'pending',
}

const BADGE = {
  muted: 'bg-muted/70 text-muted-foreground',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  success: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300',
  critical: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
}

export const LAB_CASE_STATUS_META = {
  pending:       { label: 'Case Created',         badge: BADGE.muted,    stage: 0 },
  impression_ready: { label: 'Impression Ready',   badge: BADGE.info,     stage: 1 },
  sent:          { label: 'Sent to Lab',          badge: BADGE.info,     stage: 2 },
  lab_received:  { label: 'Received by Lab',      badge: BADGE.info,     stage: 3 },
  in_production: { label: 'Manufacturing',        badge: BADGE.info,     stage: 4 },
  in_progress:   { label: 'Manufacturing',        badge: BADGE.info,     stage: 4 },
  quality_check: { label: 'Quality Check',        badge: BADGE.warning,  stage: 5 },
  ready:         { label: 'Ready for Dispatch',   badge: BADGE.success,  stage: 6 },
  delivered:     { label: 'Delivered',            badge: BADGE.success,  stage: 7 },
  received:      { label: 'Delivered',            badge: BADGE.success,  stage: 7 },
  installed:     { label: 'Installed',            badge: BADGE.success,  stage: 8 },
  approved:      { label: 'Design Approved',      badge: BADGE.success,  stage: -1 },
  revision_requested: { label: 'Revision Requested', badge: BADGE.warning, stage: -1 },
  completed:     { label: 'Completed',            badge: BADGE.success,  stage: 9 },
  cancelled:     { label: 'Cancelled',            badge: BADGE.critical, stage: -1 },
}

export const LAB_CASE_STATUSES = Object.keys(LAB_CASE_STATUS_META)

export const LAB_PORTAL_STATUS_FLOW = [
  { value: 'lab_received',  label: 'Received' },
  { value: 'in_production', label: 'Manufacturing' },
  { value: 'quality_check', label: 'Quality Check' },
  { value: 'ready',         label: 'Ready for Dispatch' },
  { value: 'delivered',     label: 'Delivered' },
]
export const LAB_PORTAL_STATUSES = LAB_PORTAL_STATUS_FLOW.map(s => s.value)

export const CLOSED_STATUSES = ['delivered', 'received', 'installed', 'completed', 'cancelled']
export const LAB_CASE_OPEN_STATUSES = LAB_CASE_STATUSES.filter(s => !CLOSED_STATUSES.includes(s))

export const AWAITING_ACCEPTANCE_STATUSES = ['sent']
export const IN_PRODUCTION_STATUSES = ['lab_received', 'in_production', 'in_progress', 'quality_check']
export const READY_STATUSES = ['ready']
export const AWAITING_DISPATCH_STATUSES = ['ready']
export const AWAITING_INSTALLATION_STATUSES = ['delivered', 'received']

/** Allowed transitions keyed by normalized status. */
export const LAB_STATUS_TRANSITIONS = {
  pending: ['impression_ready', 'sent', 'cancelled'],
  impression_ready: ['sent', 'cancelled'],
  sent: ['lab_received', 'cancelled'],
  lab_received: ['in_production', 'cancelled'],
  in_production: ['quality_check', 'ready', 'cancelled'],
  quality_check: ['ready', 'in_production', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: ['installed', 'completed', 'cancelled'],
  installed: ['completed'],
  completed: [],
  cancelled: [],
  // Legacy passthrough
  in_progress: ['quality_check', 'ready', 'cancelled'],
  received: ['installed', 'completed'],
  approved: ['sent', 'cancelled'],
  revision_requested: ['impression_ready', 'sent', 'cancelled'],
}

/** Flow action → target status. */
export const LAB_FLOW_ACTIONS = {
  impression_ready: 'impression_ready',
  send_to_lab: 'sent',
  mark_received: 'lab_received',
  start_manufacturing: 'in_production',
  start_qc: 'quality_check',
  mark_ready: 'ready',
  mark_delivered: 'delivered',
  mark_installed: 'installed',
  complete: 'completed',
  cancel: 'cancelled',
  mark_delayed: null, // special — sets delay fields only
}

export function normalizeLabStatus(status) {
  if (!status) return 'pending'
  const s = String(status).toLowerCase()
  return LEGACY_STATUS_MAP[s] || s
}

export const statusLabel = s => LAB_CASE_STATUS_META[s]?.label || LAB_CASE_STATUS_META[normalizeLabStatus(s)]?.label || (s || '').replace(/_/g, ' ')

export function canLabTransition(from, to) {
  const f = normalizeLabStatus(from)
  const t = normalizeLabStatus(to)
  if (f === t) return true
  const allowed = LAB_STATUS_TRANSITIONS[f] || LAB_STATUS_TRANSITIONS[normalizeLabStatus(f)] || []
  return allowed.includes(t)
}

export function daysRemaining(expectedDate) {
  const due = safeIsoDate(expectedDate)
  if (!due) return null
  const today = todayIso()
  const diff = Math.ceil((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000)
  return diff
}

export function safeIsoDate(v) {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

export function isOverdue(lc) {
  const due = safeIsoDate(lc?.expected_delivery_date)
  if (!due) return false
  if (CLOSED_STATUSES.includes(normalizeLabStatus(lc?.status))) return false
  return due < todayIso()
}

export function isDelayed(lc) {
  return lc?.is_delayed === true || (isOverdue(lc) && !CLOSED_STATUSES.includes(normalizeLabStatus(lc?.status)))
}

export function hasStlUploaded(lc) {
  return !!(lc?.stl_file_url || (lc?.stl_files?.length > 0))
}

export function hasImpressionReceived(lc) {
  return ['impression_ready', 'sent', 'lab_received', 'in_production', 'quality_check', 'ready', 'delivered', 'installed', 'completed']
    .includes(normalizeLabStatus(lc?.status)) || lc?.impression_received_at
}

export async function populateNames(db, cid, cases) {
  const arr = Array.isArray(cases) ? cases : [cases]
  const pids = [...new Set(arr.map(c => c.patient_id).filter(Boolean))]
  const vids = [...new Set(arr.map(c => c.vendor_id).filter(Boolean))]
  const dids = [...new Set(arr.map(c => c.doctor_id || c.created_by).filter(Boolean))]
  const [pts, vnds, docs] = await Promise.all([
    pids.length ? db.collection('patients').find(
      { id: { $in: pids }, clinic_id: cid },
      { projection: { _id: 0, id: 1, name: 1, phone: 1, date_of_birth: 1, photo_url: 1, gender: 1 } }
    ).toArray() : [],
    vids.length ? db.collection('vendors').find(
      { id: { $in: vids }, clinic_id: cid },
      { projection: { _id: 0, id: 1, name: 1, contact_person: 1, phone: 1, email: 1, material_types: 1 } }
    ).toArray() : [],
    dids.length ? db.collection('profiles').find(
      { id: { $in: dids }, clinic_id: cid },
      { projection: { _id: 0, id: 1, full_name: 1 } }
    ).toArray() : [],
  ])
  const pmap = Object.fromEntries(pts.map(p => [p.id, p]))
  const vmap = Object.fromEntries(vnds.map(v => [v.id, v]))
  const dmap = Object.fromEntries(docs.map(d => [d.id, d.full_name]))
  const enrich = c => {
    const p = pmap[c.patient_id]
    const v = vmap[c.vendor_id]
    const age = p?.date_of_birth
      ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 3600000))
      : null
    const remaining = daysRemaining(c.expected_delivery_date)
    return {
      ...c,
      status: normalizeLabStatus(c.status),
      patient_name: p?.name || 'Unknown Patient',
      patient_phone: p?.phone || '',
      patient_photo_url: p?.photo_url || null,
      patient_age: age,
      patient_gender: p?.gender || null,
      vendor_name: v?.name || 'Unknown Vendor',
      vendor_contact_person: v?.contact_person || '',
      vendor_phone: v?.phone || '',
      vendor_email: v?.email || '',
      vendor_services: v?.material_types || '',
      doctor_name: dmap[c.doctor_id || c.created_by] || '',
      overdue: isOverdue(c),
      is_delayed: isDelayed(c),
      days_remaining: remaining,
      stl_uploaded: hasStlUploaded(c),
      impression_received: hasImpressionReceived(c),
      estimated_completion: c.estimated_completion_date || c.expected_delivery_date || null,
    }
  }
  return Array.isArray(cases) ? arr.map(enrich) : enrich(arr[0])
}

export function sanitizeForPortal(lc, { labName = '' } = {}) {
  if (!lc) return null
  const timeline = (lc.timeline || []).map(t => ({
    status: t.status,
    label: statusLabel(t.status),
    note: t.note || '',
    source: t.source || 'Clinic',
    at: t.at,
  }))
  const attachments = (lc.attachments || []).map(a => ({
    id: a.id,
    file_name: a.file_name,
    file_url: a.file_url,
    file_type: a.file_type,
    file_format: a.file_format,
    file_size: a.file_size,
    uploaded_at: a.uploaded_at,
  }))
  return {
    case_number: lc.case_number,
    patient_name: lc.patient_name || 'Patient',
    lab_name: labName,
    case_type: lc.case_type || '',
    tooth_numbers: lc.tooth_numbers || '',
    shade: lc.shade || '',
    material: lc.material || '',
    notes: lc.description || '',
    urgency: lc.urgency || 'routine',
    expected_delivery_date: safeIsoDate(lc.expected_delivery_date),
    status: lc.status,
    status_label: statusLabel(lc.status),
    attachments,
    timeline,
  }
}

/** Timeline stage order for visual timeline UI. */
export const LAB_TIMELINE_STAGES = [
  'LAB_CREATED',
  'IMPRESSION_UPLOADED',
  'LAB_SENT',
  'LAB_RECEIVED',
  'LAB_MANUFACTURING_STARTED',
  'LAB_QC_STARTED',
  'LAB_DISPATCHED',
  'LAB_DELIVERED',
  'LAB_INSTALLED',
  'LAB_COMPLETED',
]

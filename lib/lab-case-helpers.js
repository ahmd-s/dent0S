import crypto from 'crypto'

// Unified status model shared by clinic staff and the public lab portal.
// Legacy statuses (in_progress, received) are kept valid for backward
// compatibility with cases created before the lab-portal workflow.
export const LAB_CASE_STATUS_META = {
  pending:       { label: 'Pending',            badge: 'bg-slate-100 text-slate-700' },
  sent:          { label: 'Sent to Lab',        badge: 'bg-blue-50 text-blue-700' },
  lab_received:  { label: 'Received by Lab',     badge: 'bg-indigo-50 text-indigo-700' },
  in_production: { label: 'In Production',        badge: 'bg-orange-50 text-orange-700' },
  ready:         { label: 'Ready',              badge: 'bg-purple-50 text-purple-700' },
  delivered:     { label: 'Delivered to Clinic', badge: 'bg-teal-50 text-teal-700' },
  in_progress:   { label: 'In Progress',         badge: 'bg-orange-50 text-orange-700' },
  received:      { label: 'Received',            badge: 'bg-teal-50 text-teal-700' },
  completed:     { label: 'Completed',           badge: 'bg-green-50 text-green-700' },
  cancelled:     { label: 'Cancelled',           badge: 'bg-red-50 text-red-600' },
}

export const LAB_CASE_STATUSES = Object.keys(LAB_CASE_STATUS_META)

// Statuses the lab can set from the public portal, in workflow order.
export const LAB_PORTAL_STATUS_FLOW = [
  { value: 'lab_received',  label: 'Received' },
  { value: 'in_production', label: 'In Production' },
  { value: 'ready',         label: 'Ready' },
  { value: 'delivered',     label: 'Delivered To Clinic' },
]
export const LAB_PORTAL_STATUSES = LAB_PORTAL_STATUS_FLOW.map(s => s.value)

// A case is "closed" once delivered/received back, completed or cancelled.
export const CLOSED_STATUSES = ['delivered', 'received', 'completed', 'cancelled']
export const LAB_CASE_OPEN_STATUSES = LAB_CASE_STATUSES.filter(s => !CLOSED_STATUSES.includes(s))

// Dashboard widget groupings.
export const AWAITING_ACCEPTANCE_STATUSES = ['sent']
export const IN_PRODUCTION_STATUSES = ['lab_received', 'in_production', 'in_progress']
export const READY_STATUSES = ['ready']

export const statusLabel = s => LAB_CASE_STATUS_META[s]?.label || (s || '').replace(/_/g, ' ')

// Null-safe ISO date (YYYY-MM-DD). Returns null for empty/invalid input.
export function safeIsoDate(v) {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

// A case is overdue only when it has a valid expected_delivery_date in the past
// and is not yet delivered/received/completed/cancelled.
export function isOverdue(lc) {
  const due = safeIsoDate(lc?.expected_delivery_date)
  if (!due) return false
  if (CLOSED_STATUSES.includes(lc?.status)) return false
  return due < todayIso()
}

// Cryptographically strong, URL-safe token for public lab links.
export function secureToken() {
  return crypto.randomBytes(24).toString('base64url')
}

// Attach patient_name and vendor contact info to a lab case (or array of them)
// using the existing patients and vendors collections.
export async function populateNames(db, cid, cases) {
  const arr = Array.isArray(cases) ? cases : [cases]
  const pids = [...new Set(arr.map(c => c.patient_id).filter(Boolean))]
  const vids = [...new Set(arr.map(c => c.vendor_id).filter(Boolean))]
  const [pts, vnds] = await Promise.all([
    pids.length ? db.collection('patients').find({ id: { $in: pids }, clinic_id: cid }).toArray() : [],
    vids.length ? db.collection('vendors').find({ id: { $in: vids }, clinic_id: cid }).toArray() : [],
  ])
  const pmap = Object.fromEntries(pts.map(p => [p.id, p]))
  const vmap = Object.fromEntries(vnds.map(v => [v.id, v]))
  const enrich = c => {
    const p = pmap[c.patient_id]
    const v = vmap[c.vendor_id]
    return {
      ...c,
      patient_name: p?.name || 'Unknown Patient',
      patient_phone: p?.phone || '',
      vendor_name: v?.name || 'Unknown Vendor',
      vendor_contact_person: v?.contact_person || '',
      vendor_phone: v?.phone || '',
      vendor_email: v?.email || '',
      overdue: isOverdue(c),
    }
  }
  return Array.isArray(cases) ? arr.map(enrich) : enrich(arr[0])
}

// Build the public-facing view of a lab case. Exposes ONLY the single case's
// clinical details needed to fabricate the work — never clinic settings,
// other patients/vendors, internal ids, staff identities or contact data.
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

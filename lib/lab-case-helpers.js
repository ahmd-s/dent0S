export const LAB_CASE_STATUSES = ['pending', 'sent', 'in_progress', 'received', 'completed', 'cancelled']
export const LAB_CASE_OPEN_STATUSES = ['pending', 'sent', 'in_progress']
const CLOSED = ['received', 'completed', 'cancelled']

// Null-safe ISO date (YYYY-MM-DD). Returns null for empty/invalid input.
export function safeIsoDate(v) {
  if (!v) return null
  const d = new Date(v)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

// A case is overdue only when it has a valid expected_delivery_date in the past
// and is not yet received/completed/cancelled.
export function isOverdue(lc) {
  const due = safeIsoDate(lc?.expected_delivery_date)
  if (!due) return false
  if (CLOSED.includes(lc?.status)) return false
  return due < todayIso()
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

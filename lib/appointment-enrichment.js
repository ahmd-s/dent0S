/**
 * Enrich appointment documents with patient, doctor, chair, visit, lab, balance data.
 */

import { clean } from '@/lib/api-helpers'
import { normalizeStatus } from '@/lib/appointment-status'

export async function enrichAppointments(db, clinicId, appointments) {
  if (!appointments?.length) return []

  const pids = [...new Set(appointments.map(a => a.patient_id).filter(Boolean))]
  const dids = [...new Set(appointments.map(a => a.doctor_id).filter(Boolean))]
  const cids = [...new Set(appointments.map(a => a.chair_id).filter(Boolean))]
  const aids = appointments.map(a => a.id)

  const [pts, docs, chairs, visits, labCases, invoices] = await Promise.all([
    pids.length ? db.collection('patients').find({ id: { $in: pids }, clinic_id: clinicId }).toArray() : [],
    dids.length ? db.collection('profiles').find({ id: { $in: dids }, clinic_id: clinicId }).toArray() : [],
    cids.length ? db.collection('clinic_chairs').find({ id: { $in: cids }, clinic_id: clinicId }).toArray() : [],
    db.collection('visits').find({ clinic_id: clinicId, appointment_id: { $in: aids } }).toArray(),
    pids.length
      ? db.collection('lab_cases').find({
          clinic_id: clinicId,
          patient_id: { $in: pids },
          status: { $nin: ['delivered', 'cancelled'] },
        }).toArray()
      : [],
    pids.length
      ? db.collection('invoices').find({
          clinic_id: clinicId,
          patient_id: { $in: pids },
          payment_status: { $in: ['pending', 'partial'] },
        }).toArray()
      : [],
  ])

  const pmap = Object.fromEntries(pts.map(p => [p.id, p]))
  const dmap = Object.fromEntries(docs.map(d => [d.id, d.full_name]))
  const cmap = Object.fromEntries(chairs.map(c => [c.id, c.name]))
  const vmap = Object.fromEntries(visits.map(v => [v.appointment_id, v.id]))
  const labByPatient = {}
  for (const lc of labCases) {
    labByPatient[lc.patient_id] = (labByPatient[lc.patient_id] || 0) + 1
  }
  const balanceByPatient = {}
  for (const inv of invoices) {
    const due = (inv.total_amount || 0) - (inv.amount_paid || 0)
    balanceByPatient[inv.patient_id] = (balanceByPatient[inv.patient_id] || 0) + due
  }

  return appointments.map(a => {
    const pt = pmap[a.patient_id]
    return {
      ...clean(a),
      status: normalizeStatus(a.status),
      patient_name: pt?.name || a.patient_name_temp,
      patient_phone: pt?.phone || a.patient_phone_temp,
      patient_total_visits: pt?.total_visits || 0,
      doctor_name: dmap[a.doctor_id] || '',
      chair_name: a.chair_id ? cmap[a.chair_id] || '' : '',
      visit_id: vmap[a.id] || null,
      has_outstanding_balance: a.patient_id ? (balanceByPatient[a.patient_id] || 0) > 0 : false,
      outstanding_balance: a.patient_id ? balanceByPatient[a.patient_id] || 0 : 0,
      lab_pending_count: a.patient_id ? labByPatient[a.patient_id] || 0 : 0,
    }
  })
}

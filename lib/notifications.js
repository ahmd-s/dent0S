import { v4 as uuidv4 } from 'uuid'
import { statusLabel } from '@/lib/lab-case-helpers'

// Clinic-facing, in-app notifications. Intentionally minimal and quiet: we only
// create a record for meaningful lab status changes so the clinic has a single
// systematic place (the header bell) to glance at progress on its own schedule —
// no popups, email, or SMS. Best-effort: a logging failure must never break the
// underlying operation.
export async function createLabStatusNotification(db, { clinicId, labCase, status, labName, note }) {
  try {
    if (!clinicId || !labCase) return
    const label = statusLabel(status)
    await db.collection('notifications').insertOne({
      id: uuidv4(),
      clinic_id: clinicId,
      type: 'lab_status',
      lab_case_id: labCase.id,
      case_number: labCase.case_number || '',
      patient_name: labCase.patient_name || '',
      status,
      status_label: label,
      lab_name: labName || '',
      note: (note || '').toString().slice(0, 300),
      message: `${labCase.case_number || 'Lab case'} · ${labCase.patient_name || 'Patient'} → ${label}`,
      source: 'Lab Portal',
      read: false,
      created_at: new Date(),
    })
  } catch (e) {
    console.error('Notification create error:', e)
  }
}

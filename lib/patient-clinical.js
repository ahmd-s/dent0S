/**
 * Derive clinical context from patient + visits for the Clinical Workspace.
 */

export function fmtPatientDate(d) {
  if (!d) return '—'
  const x = new Date(d)
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`
}

export function deriveClinicalSummary(patient, visits = []) {
  const latest = visits[0] || null
  const prescriptions = visits.flatMap(v => v.prescriptions || [])

  const completedTreatments = visits
    .filter(v => v.treatment_done)
    .map(v => ({ date: v.visit_date, text: v.treatment_done, visitId: v.id }))

  const pendingPlans = visits
    .filter(v => v.treatment_plan && !v.treatment_done)
    .map(v => ({ date: v.visit_date, text: v.treatment_plan, visitId: v.id }))

  return {
    chief_complaint: latest?.chief_complaint || '',
    diagnosis: latest?.diagnosis || '',
    current_treatment: latest?.treatment_done || latest?.treatment_plan || '',
    treatment_plan: latest?.treatment_plan || '',
    clinical_notes: latest?.clinical_notes || '',
    medical_alerts: buildMedicalAlerts(patient),
    allergies: patient?.allergies || '',
    current_medications: prescriptions.slice(0, 8).map(p => ({
      name: p.medicine_name,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration,
    })),
    treatment_progress: {
      completed: completedTreatments.length,
      pending: pendingPlans.length,
      total_visits: visits.length,
    },
    pinned_notes: patient?.internal_remarks || '',
    latest_visit_id: latest?.id || null,
    latest_visit_date: latest?.visit_date || patient?.last_visit_date || null,
  }
}

export function buildMedicalAlerts(patient) {
  const alerts = []
  if (patient?.allergies) alerts.push({ type: 'allergy', label: 'Allergies', text: patient.allergies, severity: 'high' })
  if (patient?.medical_history) alerts.push({ type: 'history', label: 'Medical History', text: patient.medical_history, severity: 'medium' })
  if (patient?.blood_group) alerts.push({ type: 'blood', label: 'Blood Group', text: patient.blood_group, severity: 'low' })
  return alerts
}

export function buildStatusChips(patient, appointments = [], balance = 0) {
  const chips = []
  const today = new Date().toISOString().slice(0, 10)

  if (patient?.allergies) chips.push({ label: 'Allergies', color: 'red' })
  if (balance > 0) chips.push({ label: 'Outstanding Balance', color: 'amber' })
  if (patient?.next_followup_date && patient.next_followup_date <= today) {
    chips.push({ label: 'Follow-up Due', color: 'orange' })
  }

  const upcoming = appointments.find(a => a.appointment_date >= today && !['cancelled', 'no_show'].includes(a.status))
  if (upcoming) chips.push({ label: 'Appointment Scheduled', color: 'blue' })

  if ((patient?.total_visits || 0) === 0) chips.push({ label: 'New Patient', color: 'teal' })
  else if ((patient?.total_visits || 0) >= 5) chips.push({ label: 'Regular', color: 'green' })

  return chips
}

export function getUpcomingAppointment(appointments = []) {
  const today = new Date().toISOString().slice(0, 10)
  return appointments
    .filter(a => a.appointment_date >= today && !['cancelled', 'no_show'].includes(a.status))
    .sort((a, b) => `${a.appointment_date}${a.appointment_time}`.localeCompare(`${b.appointment_date}${b.appointment_time}`))[0] || null
}

export const CHIP_COLORS = {
  red: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
  teal: 'bg-[#0D9488]/15 text-[#0D9488]',
  green: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-300',
}

/** Patient workspace tab definitions mapped to workspace patient_page keys. */
export const PATIENT_WORKSPACE_TABS = [
  { id: 'overview', label: 'Clinical', flags: ['treatment_history', 'clinical_notes'], always: true },
  { id: 'timeline', label: 'Timeline', flags: ['timeline'] },
  { id: 'treatment', label: 'Treatment', flags: ['treatment_history', 'visits'] },
  { id: 'tooth_chart', label: 'Tooth Chart', flags: ['tooth_chart'] },
  { id: 'prescriptions', label: 'Prescriptions', flags: ['prescriptions'] },
  { id: 'ai', label: 'AI Workspace', flags: ['ai_summary'] },
  { id: 'documents', label: 'Documents', flags: ['documents', 'xrays'] },
  { id: 'lab', label: 'Lab', flags: ['lab_reports'] },
  { id: 'inventory', label: 'Materials', flags: ['inventory_usage'] },
  { id: 'billing', label: 'Financial', flags: ['billing', 'payments'] },
  { id: 'appointments', label: 'Appointments', flags: [], always: true },
  { id: 'consents', label: 'Consents', flags: ['consents'] },
  { id: 'followups', label: 'Follow-ups', flags: ['followups'] },
  { id: 'communication', label: 'Communication', flags: ['communication'] },
  { id: 'remarks', label: 'Internal Notes', flags: ['internal_remarks'] },
]

export function getVisiblePatientTabs(isSectionEnabled) {
  return PATIENT_WORKSPACE_TABS.filter(tab => {
    if (tab.always) return true
    return tab.flags.some(f => isSectionEnabled(f))
  })
}

export function trackRecentPatient(patientId, name) {
  if (typeof window === 'undefined' || !patientId) return
  try {
    const key = 'dentos_recent_patients'
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
    const filtered = raw.filter(p => p.id !== patientId)
    const next = [{ id: patientId, name, viewed_at: new Date().toISOString() }, ...filtered].slice(0, 8)
    localStorage.setItem(key, JSON.stringify(next))
  } catch { /* ignore */ }
}

export function getRecentPatients() {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem('dentos_recent_patients') || '[]')
  } catch {
    return []
  }
}

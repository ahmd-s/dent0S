'use client'

import { Card } from '@/components/ui/card'
import { fmtPatientDate } from '@/lib/patient-clinical'

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function PatientAppointmentsPanel({ appointments = [] }) {
  const upcoming = appointments.filter(a => a.appointment_date >= todayIso() && !['cancelled', 'no_show'].includes(a.status))
  const past = appointments.filter(a => a.appointment_date < todayIso() || ['cancelled', 'no_show'].includes(a.status))

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.map(a => (
              <Card key={a.id} className="p-4 bg-blue-50/50 border-blue-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-medium">{fmtPatientDate(a.appointment_date)} · {a.appointment_time}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace('_', ' ')} · Dr. {a.doctor_name || '—'}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 capitalize">{a.status?.replace('_', ' ')}</span>
              </Card>
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Past</h3>
          <div className="space-y-2">
            {past.slice(0, 10).map(a => (
              <Card key={a.id} className="p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-medium">{fmtPatientDate(a.appointment_date)} · {a.appointment_time}</div>
                  <div className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace('_', ' ')}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">{a.status?.replace('_', ' ')}</span>
              </Card>
            ))}
          </div>
        </section>
      )}
      {upcoming.length === 0 && past.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground rounded-xl">No appointments yet</Card>
      )}
    </div>
  )
}

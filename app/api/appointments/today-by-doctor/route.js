import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    // Verify internal API key
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey || apiKey !== process.env.WHATSAPP_SERVICE_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = await getDb()
    
    // Get today's date in IST (UTC+5:30)
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const today = istNow.toISOString().slice(0, 10)

    // Get all today's appointments across all clinics
    const appointments = await db.collection('appointments')
      .find({ 
        appointment_date: today,
        status: { $nin: ['cancelled', 'no_show', 'completed'] }
      })
      .sort({ appointment_time: 1 })
      .toArray()

    if (!appointments.length) {
      return NextResponse.json({ doctors: [] })
    }

    // Get unique doctor IDs
    const doctorIds = [...new Set(appointments.map(a => a.doctor_id).filter(Boolean))]
    
    // Get doctor profiles with whatsapp_number
    const doctors = await db.collection('profiles')
      .find({ 
        id: { $in: doctorIds },
        role: 'doctor',
        whatsapp_number: { $exists: true, $ne: '', $ne: null }
      })
      .toArray()

    // Get patient names
    const patientIds = [...new Set(appointments.map(a => a.patient_id).filter(Boolean))]
    const patients = patientIds.length 
      ? await db.collection('patients').find({ id: { $in: patientIds } }).toArray()
      : []
    const patientMap = Object.fromEntries(patients.map(p => [p.id, p.name]))

    // Get clinic names
    const clinicIds = [...new Set(doctors.map(d => d.clinic_id).filter(Boolean))]
    const clinics = clinicIds.length
      ? await db.collection('clinics').find({ id: { $in: clinicIds } }).toArray()
      : []
    const clinicMap = Object.fromEntries(clinics.map(c => [c.id, c.name]))

    // Group appointments by doctor
    const result = doctors.map(doctor => {
      const doctorAppts = appointments
        .filter(a => a.doctor_id === doctor.id)
        .map(a => ({
          time: a.appointment_time,
          patient_name: patientMap[a.patient_id] || a.patient_name_temp || 'Unknown',
          treatment: a.chief_complaint || a.appointment_type || 'Consultation'
        }))

      return {
        doctor_name: doctor.full_name,
        doctor_whatsapp: doctor.whatsapp_number,
        clinic_name: clinicMap[doctor.clinic_id] || 'Clinic',
        appointments: doctorAppts
      }
    }).filter(d => d.appointments.length > 0)

    return NextResponse.json({ doctors: result, date: today })

  } catch (e) {
    console.error('today-by-doctor error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

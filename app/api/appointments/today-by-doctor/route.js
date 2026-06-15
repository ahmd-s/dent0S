import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

export async function GET(request) {
  try {
    // Check API key
    const apiKey = request.headers.get('x-api-key')
    if (apiKey !== process.env.WHATSAPP_SERVICE_API_KEY) {
      return err('Unauthorized', 401)
    }

    const db = await getDb()

    // Get today's date range in IST
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    // Find ALL appointments across ALL clinics for today
    const appointments = await db.collection('appointments').find({
      appointment_date: {
        $gte: todayStart.toISOString().slice(0, 10),
        $lte: todayEnd.toISOString().slice(0, 10)
      },
      status: { $nin: ['cancelled'] }
    }).toArray()

    // Get unique doctor_ids
    const doctorIds = [...new Set(appointments.map(a => a.doctor_id).filter(Boolean))]

    // Get patient IDs
    const patientIds = [...new Set(appointments.map(a => a.patient_id).filter(Boolean))]

    // Fetch doctors and patients in parallel
    const [doctors, patients, clinics] = await Promise.all([
      doctorIds.length ? db.collection('profiles').find({ id: { $in: doctorIds } }).toArray() : [],
      patientIds.length ? db.collection('patients').find({ id: { $in: patientIds } }).toArray() : [],
      // Get clinics for doctor context
      doctorIds.length ? db.collection('clinics').find({ id: { $in: doctors.map(d => d.clinic_id) } }).toArray() : []
    ])

    // Create lookup maps
    const doctorMap = Object.fromEntries(doctors.map(d => [d.id, d]))
    const patientMap = Object.fromEntries(patients.map(p => [p.id, p]))
    const clinicMap = Object.fromEntries(clinics.map(c => [c.id, c]))

    // Group by doctor
    const doctorsWithAppointments = []

    for (const doctorId of doctorIds) {
      const doctor = doctorMap[doctorId]
      
      // Only include doctors with whatsapp_number
      if (!doctor || !doctor.whatsapp_number) {
        continue
      }

      const clinic = clinicMap[doctor.clinic_id]

      const doctorAppointments = appointments
        .filter(a => a.doctor_id === doctorId)
        .map(a => ({
          time: a.appointment_time,
          patient_name: patientMap[a.patient_id]?.name || a.patient_name_temp || 'Unknown',
          treatment: a.appointment_type || a.chief_complaint || ''
        }))
        .sort((a, b) => a.time.localeCompare(b.time))

      if (doctorAppointments.length > 0) {
        doctorsWithAppointments.push({
          doctor_name: doctor.full_name,
          doctor_whatsapp: doctor.whatsapp_number,
          clinic_name: clinic?.name || 'Unknown Clinic',
          appointments: doctorAppointments
        })
      }
    }

    return json({ doctors: doctorsWithAppointments })
  } catch (e) {
    console.error('Today appointments error:', e)
    return err('Internal server error', 500)
  }
}

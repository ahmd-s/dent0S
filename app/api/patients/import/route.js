import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { v4 as uuidv4 } from 'uuid'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

function normalizeColumn(col) {
  return col.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

function parseCSVRow(row, headers) {
  const values = row.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
  const obj = {}
  headers.forEach((h, i) => {
    obj[h] = values[i] || ''
  })
  return obj
}

export async function POST(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)

    const { profile, clinic, db } = user
    const cid = profile.clinic_id

    if (profile.role === 'receptionist') return err('Forbidden', 403)

    const { patients } = await request.json()
    if (!Array.isArray(patients)) return err('Invalid input: patients array required')

    let imported = 0
    let skipped = 0
    const errors = []

    // Get last patient code for this clinic
    const lastPatient = await db.collection('patients')
      .find({ clinic_id: clinic.id, patient_code: { $regex: /^PT\d+$/ } })
      .sort({ patient_code: -1 })
      .limit(1)
      .toArray()
    const lastNum = lastPatient.length > 0
      ? parseInt(lastPatient[0].patient_code.replace('PT', ''))
      : 0

    for (let i = 0; i < patients.length; i++) {
      const p = patients[i]
      const row = i + 2 // +2 because row 1 is header

      try {
        // Normalize and validate required fields
        const name = p.name || p.Name || ''
        const phone = p.phone || p.Phone || ''
        const email = p.email || p.Email || ''
        const dob = p.date_of_birth || p.Date_of_Birth || p.dob || p.DOB || ''
        const gender = p.gender || p.Gender || ''
        const address = p.address || p.Address || ''
        const allergies = p.allergies || p.Allergies || ''
        const blood_group = p.blood_group || p.Blood_Group || ''

        if (!name || !phone) {
          errors.push({ row, error: 'Missing required fields: name and phone' })
          continue
        }

        // Clean phone number
        const cleanPhone = phone.toString().trim().replace(/\D/g, '')
        if (!/^\d{10}$/.test(cleanPhone)) {
          errors.push({ row, error: 'Invalid phone number (must be 10 digits)' })
          continue
        }

        // Check if patient already exists (same clinic + phone + name)
        const nameRegex = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        const existing = await db.collection('patients').findOne(
          { clinic_id: cid, phone: cleanPhone, name: { $regex: nameRegex }, is_archived: { $ne: true } }
        )

        if (existing) {
          skipped++
          continue
        }

        // Calculate age from DOB if provided
        let age = null
        if (dob) {
          const dobDate = new Date(dob)
          const today = new Date()
          age = today.getFullYear() - dobDate.getFullYear() - 
                (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate()) ? 1 : 0)
        }

        // Generate patient code
        const patientCode = 'PT' + String(lastNum + imported + 1).padStart(5, '0')

        // Insert patient
        await db.collection('patients').insertOne({
          id: uuidv4(),
          clinic_id: cid,
          name: name.trim(),
          phone: cleanPhone,
          email: email || null,
          dob: dob || null,
          age: age,
          gender: gender?.toLowerCase() || '',
          blood_group: blood_group || '',
          allergies: allergies || '',
          medical_history: '',
          address: address || '',
          referral_source: 'csv_import',
          patient_code: patientCode,
          total_visits: 0,
          is_archived: false,
          created_by: profile.id,
          created_via: 'csv_import',
          created_at: new Date()
        })

        imported++
      } catch (err) {
        errors.push({ row, error: err.message })
      }
    }

    return json({
      imported,
      skipped,
      errors,
      total: patients.length
    })

  } catch (error) {
    console.error('Patient import error:', error)
    return err('Internal server error', 500)
  }
}

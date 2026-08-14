import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { nextPatientCode } from '@/lib/patient-code'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import {
  transformRows,
  validatePatient,
  normalizePhone,
  normalizeGender,
  normalizeDate,
  ageFromDob,
} from '@/lib/patient-import'
import { v4 as uuidv4 } from 'uuid'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

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
  return loadUserContext(db, t.uid)
}

function normalizeLegacyRow(p) {
  return {
    name: (p.name || p.Name || '').trim(),
    phone: normalizePhone(p.phone || p.Phone || p.mobile || p.Mobile || ''),
    email: (p.email || p.Email || '').trim(),
    dob: normalizeDate(p.date_of_birth || p.Date_of_Birth || p.dob || p.DOB || ''),
    gender: normalizeGender(p.gender || p.Gender || ''),
    address: (p.address || p.Address || '').trim(),
    allergies: (p.allergies || p.Allergies || '').trim(),
    blood_group: (p.blood_group || p.Blood_Group || '').trim(),
    medical_history: (p.medical_history || p.Medical_History || '').trim(),
    referral_source: (p.referral_source || p.Referral_Source || 'csv_import').trim(),
  }
}

export async function POST(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(user.clinic)) return clinicAccessPausedResponse(err)

    const { profile, db } = user
    const cid = profile.clinic_id

    if (!hasPermission(profile, 'patients', 'create')) return err('Forbidden', 403)

    const body = await request.json()
    const { patients, rows, mapping, source } = body

    let normalized = []

    if (Array.isArray(rows) && mapping && typeof mapping === 'object') {
      const { patients: transformed } = transformRows(rows, mapping, source || 'practo')
      normalized = transformed.map((p, i) => ({
        ...p,
        _row: p._row ?? i + 2,
      }))
    } else if (Array.isArray(patients)) {
      normalized = patients.map((p, i) => {
        const row = normalizeLegacyRow(p)
        return { ...row, _row: i + 2, _issues: validatePatient(row, i + 2) }
      })
    } else {
      return err('Invalid input: provide patients array or rows + mapping')
    }

    let imported = 0
    let skipped = 0
    const errors = []

    for (const p of normalized) {
      const row = p._row

      if (p._issues?.length) {
        errors.push({ row, error: p._issues.join('; ') })
        continue
      }

      try {
        const { name, phone, email, dob, gender, address, allergies, blood_group, medical_history, referral_source } = p

        const nameRegex = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        const existing = await db.collection('patients').findOne({
          clinic_id: cid,
          phone,
          name: { $regex: nameRegex },
          is_archived: { $ne: true },
        })

        if (existing) {
          skipped++
          continue
        }

        const age = ageFromDob(dob)

        const patientCode = await nextPatientCode(db, cid)

        await db.collection('patients').insertOne({
          id: uuidv4(),
          clinic_id: cid,
          name,
          phone,
          email: email || null,
          dob: dob || null,
          age,
          gender: gender || '',
          blood_group: blood_group || '',
          allergies: allergies || '',
          medical_history: medical_history || '',
          address: address || '',
          referral_source: referral_source || (source ? `${source}_import` : 'csv_import'),
          patient_code: patientCode,
          total_visits: 0,
          is_archived: false,
          created_by: profile.id,
          created_via: 'csv_import',
          created_at: new Date(),
        })

        imported++
      } catch (e) {
        errors.push({ row, error: e.message })
      }
    }

    return json({
      imported,
      skipped,
      errors,
      total: normalized.length,
    })
  } catch (error) {
    console.error('Patient import error:', error)
    return err('Internal server error', 500)
  }
}

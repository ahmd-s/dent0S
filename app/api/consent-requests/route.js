import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export async function GET(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    
    const { profile, db } = user
    const cid = profile.clinic_id
    const url = new URL(request.url)
    const patient_id = url.searchParams.get('patient_id')
    
    const filter = { clinic_id: cid }
    if (patient_id) filter.patient_id = patient_id
    
    const requests = await db.collection('consent_requests')
      .find(filter)
      .sort({ sent_at: -1 })
      .toArray()
    
    // Enrich with template and patient names
    const enriched = await Promise.all(requests.map(async (req) => {
      const template = await db.collection('consent_templates').findOne({ id: req.template_id, clinic_id: cid })
      const patient = await db.collection('patients').findOne({ id: req.patient_id, clinic_id: cid })
      return {
        ...clean(req),
        template_name: template?.name || 'Unknown Template',
        patient_name: patient?.name || 'Unknown Patient'
      }
    }))
    
    return json({ consent_requests: enriched })
  } catch (error) {
    console.error('Consent requests API error:', error)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(user.clinic)) return clinicAccessPausedResponse(err)
    
    const { profile, db } = user
    const cid = profile.clinic_id
    
    const b = await request.json()
    if (!b.patient_id || !b.template_id) return err('Patient ID and Template ID required')
    
    // Verify patient belongs to clinic
    const patient = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
    if (!patient) return err('Patient not found', 404)
    
    // Verify template belongs to clinic
    const template = await db.collection('consent_templates').findOne({ id: b.template_id, clinic_id: cid })
    if (!template) return err('Template not found', 404)
    if (!template.active) return err('Template is inactive')
    
    const id = uuidv4()
    const unique_token = uuidv4()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
    
    await db.collection('consent_requests').insertOne({
      id,
      clinic_id: cid,
      patient_id: b.patient_id,
      template_id: b.template_id,
      unique_token,
      status: 'Pending',
      sent_at: now,
      signed_at: null,
      signature_image: null,
      patient_name: patient.name,
      ip_address: null,
      expires_at: expiresAt
    })
    
    // Generate public link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
    const consentLink = `${baseUrl}/consent/${unique_token}`

    await logActivity(db, profile, ACTIVITY_EVENTS.CONSENT_SENT, {
      patientId: b.patient_id,
      metadata: { template_name: template.name, patient_name: patient.name },
    })
    
    return json({ ok: true, id, consent_link: consentLink, unique_token })
  } catch (error) {
    console.error('Consent request creation error:', error)
    return err('Internal server error', 500)
  }
}

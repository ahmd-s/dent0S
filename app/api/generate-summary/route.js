import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { canAccessClinical } from '@/lib/rbac'
import { createAnthropicMessage } from '@/lib/anthropic-messages'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canAccessClinical(profile)) return err('Forbidden', 403)
    const b = await request.json()
    if (!b.patient_id) return err('patient_id required')
    const p = await db.collection('patients').findOne({ id: b.patient_id, clinic_id: cid })
    if (!p) return err('Patient not found', 404)
    const visits = await db.collection('visits').find({ patient_id: b.patient_id, clinic_id: cid }).sort({ visit_date: -1, created_at: -1 }).limit(8).toArray()
    if (visits.length === 0) return err('No visits to summarize yet', 400)
    const visitText = visits.map(v => `Date: ${v.visit_date}\nComplaint: ${v.chief_complaint||'-'}\nDiagnosis: ${v.diagnosis||'-'}\nTreatment: ${v.treatment_done||'-'}\nPlan: ${v.treatment_plan||'-'}\n---`).join('\n')
    const prompt = `You are a clinical documentation assistant for a dental clinic in India. Based on the visit history below, write a concise clinical summary (maximum 200 words).\n\nCover: main dental complaints, treatments completed, current dental status, and recommended follow-up actions already mentioned by the doctor.\n\nDo not diagnose. Do not suggest treatments not already mentioned in the notes. Use professional clinical language.\n\nPatient: ${p.name}, Age: ${p.age||'unknown'}\nBlood Group: ${p.blood_group||'unknown'}\nKnown Allergies: ${p.allergies||'None recorded'}\n\nVisit History (most recent first):\n${visitText}\n\nWrite the clinical summary now:`
    try {
      const text = await createAnthropicMessage({
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      })
      if (!text) return err('Empty AI response', 500)
      await db.collection('patients').updateOne({ id: b.patient_id, clinic_id: cid }, { $set: { ai_summary: text, ai_summary_generated_at: new Date() } })
      return json({ ok: true, summary: text, generated_at: new Date() })
    } catch (e) {
      console.error('AI summary error:', e?.message || e)
      return err(`AI service error: ${e?.message || 'Unknown'}`, 502)
    }
  } catch (e) {
    console.error('Generate summary error:', e)
    return err('Internal server error', 500)
  }
}

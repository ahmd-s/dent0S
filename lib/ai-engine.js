/**
 * AI Engine — single orchestration layer for all AI features (Sprint 18).
 * API routes must delegate here. No AI logic in route handlers.
 *
 * Constraints: suggest · draft · recommend · explain — never autonomous diagnosis.
 */

import { v4 as uuidv4 } from 'uuid'
import axios from 'axios'
import { createAnthropicMessage } from '@/lib/anthropic-messages'
import { logAIEvent } from '@/lib/ai-activity'
import { deriveClinicalSummary, buildMedicalAlerts } from '@/lib/patient-clinical'
import { computeFlowMetrics } from '@/lib/dental-flow-engine'
import { computeLabMetrics } from '@/lib/lab-workflow-engine'
import { computeInventoryMetrics } from '@/lib/inventory-workflow-engine'
import { getKpis } from '@/lib/analytics-engine'
import { filenameForAudioMime, groqMimeForAudio, mapVoiceProviderError } from '@/lib/voice-audio'

const CACHE_TTL_MS = 120_000
const cache = new Map()

export const AI_REQUEST_TYPES = {
  CLINICAL_SUMMARY: 'clinical_summary',
  PATIENT_HISTORY: 'patient_history',
  TREATMENT_SUGGESTION: 'treatment_suggestion',
  PRESCRIPTION_DRAFT: 'prescription_draft',
  PATIENT_EXPLANATION: 'patient_explanation',
  RECALL_SUGGESTION: 'recall_suggestion',
  FOLLOWUP_SUGGESTION: 'followup_suggestion',
  APPOINTMENT_PREP: 'appointment_prep',
  LAB_SUMMARY: 'lab_summary',
  INVENTORY_INSIGHT: 'inventory_insight',
  BUSINESS_INSIGHT: 'business_insight',
  DOCTOR_BRIEF: 'doctor_brief',
  VOICE_SUMMARY: 'voice_summary',
  XRAY_ANALYSIS: 'xray_analysis',
  AUTOMATION: 'automation',
}

const SAFETY_PREFIX = 'You are a dental clinic documentation assistant in India. Suggest, draft, recommend, or explain only. Never diagnose autonomously. Never override doctor decisions. Use professional clinical language.'

function cacheKey(clinicId, fn, opts = {}) {
  return `${clinicId}:${fn}:${JSON.stringify(opts)}`
}

function getCached(key) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data
  return null
}

function setCache(key, data) {
  cache.set(key, { data, at: Date.now() })
  if (cache.size <= 200) return
  let oldestKey = null
  let oldestAt = Infinity
  for (const [k, v] of cache) {
    if (v.at < oldestAt) {
      oldestAt = v.at
      oldestKey = k
    }
  }
  if (oldestKey) cache.delete(oldestKey)
}

const inflight = new Map()

/**
 * Cache read with single-flight coalescing.
 *
 * A cache lookup alone still let concurrent callers each reach the provider:
 * two clinicians opening the same patient at once, or a double-click, produced
 * two billable completions for an identical prompt. Concurrent callers now
 * await the same promise.
 */
async function withCache(key, compute) {
  const hit = getCached(key)
  if (hit) return hit
  if (inflight.has(key)) return inflight.get(key)

  const promise = Promise.resolve()
    .then(compute)
    .then(result => {
      // Only successful results are cached, so a transient provider failure
      // isn't pinned for the TTL.
      if (result?.ok !== false) setCache(key, result)
      return result
    })
    .finally(() => inflight.delete(key))

  inflight.set(key, promise)
  return promise
}

function cleanDoc(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return rest
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

const GROQ_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000)

let groqAgent = null

/**
 * Shared keep-alive agent for the AI provider.
 *
 * Each call previously built `new https.Agent({ rejectUnauthorized: false })`.
 * That disabled TLS certificate verification on a connection carrying patient
 * clinical data to a third party, which made it interceptable, and it also
 * forced a fresh TLS handshake for every request. Certificates are now verified
 * (the default) and the connection is reused.
 */
async function getGroqAgent() {
  if (groqAgent) return groqAgent
  const https = await import('https')
  groqAgent = new https.Agent({ keepAlive: true, maxSockets: 20 })
  return groqAgent
}

async function groqChat(messages, maxTokens = 600) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not configured')
  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    { model: 'llama-3.3-70b-versatile', max_tokens: maxTokens, temperature: 0.2, messages },
    {
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      httpsAgent: await getGroqAgent(),
      timeout: GROQ_TIMEOUT_MS,
    }
  )
  return response.data.choices[0]?.message?.content?.trim() || ''
}

async function llmComplete(systemPrompt, userPrompt, opts = {}) {
  const { preferAnthropic = false, maxTokens = 600 } = opts
  if (preferAnthropic && (process.env.ANTHROPIC_API_KEY || process.env.EMERGENT_LLM_KEY)) {
    return createAnthropicMessage({
      max_tokens: maxTokens,
      messages: [
        { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
      ],
    })
  }
  return groqChat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], maxTokens)
}

async function logRequest(db, profile, type, meta = {}) {
  const doc = {
    id: uuidv4(),
    clinic_id: profile.clinic_id,
    user_id: profile.id,
    type,
    status: meta.status || 'completed',
    provider: meta.provider || 'groq',
    patient_id: meta.patient_id || null,
    visit_id: meta.visit_id || null,
    tokens_estimated: meta.tokens_estimated || null,
    created_at: new Date(),
  }
  try {
    await db.collection('ai_requests').insertOne(doc)
  } catch { /* best-effort */ }
  try {
    await logAIEvent(db, profile, doc)
  } catch { /* best-effort */ }
  return doc
}

async function loadPatientContext(db, clinicId, patientId) {
  const [patient, visits, appointments, invoices, labCases] = await Promise.all([
    db.collection('patients').findOne({ id: patientId, clinic_id: clinicId }),
    db.collection('visits').find({ patient_id: patientId, clinic_id: clinicId })
      .sort({ visit_date: -1, created_at: -1 }).limit(10).toArray(),
    db.collection('appointments').find({ patient_id: patientId, clinic_id: clinicId })
      .sort({ appointment_date: -1 }).limit(5).toArray(),
    db.collection('invoices').find({ patient_id: patientId, clinic_id: clinicId, payment_status: { $in: ['pending', 'partial'] } }).toArray(),
    db.collection('lab_cases').find({ patient_id: patientId, clinic_id: clinicId })
      .sort({ created_at: -1 }).limit(5).toArray(),
  ])
  if (!patient) return null

  const prescriptions = visits.flatMap(v => v.prescriptions || [])
  const balance = invoices.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0)
  const clinical = deriveClinicalSummary(patient, visits)

  return { patient, visits, appointments, invoices, labCases, prescriptions, balance, clinical }
}

function buildVisitText(visits) {
  return visits.map(v =>
    `Date: ${v.visit_date}\nComplaint: ${v.chief_complaint || '-'}\nDiagnosis: ${v.diagnosis || '-'}\nTreatment: ${v.treatment_done || '-'}\nPlan: ${v.treatment_plan || '-'}\n---`
  ).join('\n')
}

function isAllowedImageUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (url.startsWith('https://res.cloudinary.com/')) return true
  if (url.includes('cloudinary')) return true
  const allowed = process.env.AI_ALLOWED_IMAGE_HOSTS
  if (allowed) {
    return allowed.split(',').some(h => url.includes(h.trim()))
  }
  return url.startsWith('https://')
}

/** Core: clinical summary — reuses existing patient summary flow */
export async function generateClinicalSummary(db, profile, { patientId, force = false } = {}) {
  const ctx = await loadPatientContext(db, profile.clinic_id, patientId)
  if (!ctx) return { ok: false, error: 'Patient not found' }
  if (!ctx.visits.length) return { ok: false, error: 'No visits to summarize yet' }

  const cacheK = cacheKey(profile.clinic_id, 'clinical_summary', { patientId })
  if (!force) {
    const cached = getCached(cacheK)
    if (cached) return cached
    if (ctx.patient.ai_summary && ctx.patient.ai_summary_generated_at) {
      const lastVisit = ctx.visits[0]?.visit_date
      if (!lastVisit || new Date(ctx.patient.ai_summary_generated_at) >= new Date(lastVisit)) {
        return { ok: true, summary: ctx.patient.ai_summary, generated_at: ctx.patient.ai_summary_generated_at, cached: true }
      }
    }
    // Coalesce concurrent generations for the same patient into one completion.
    if (inflight.has(cacheK)) return inflight.get(cacheK)
  }

  const generate = async () => {
    const { patient, visits } = ctx
    const systemPrompt = `${SAFETY_PREFIX}\nWrite a concise clinical summary (max 200 words). Cover complaints, treatments completed, current status, and documented follow-up. Do not suggest new treatments.`
    const userPrompt = `Patient: ${patient.name}, Age: ${patient.age || 'unknown'}\nAllergies: ${patient.allergies || 'None'}\n\nVisit History:\n${buildVisitText(visits)}\n\nSummary:`

    try {
      const text = await llmComplete(systemPrompt, userPrompt)
      if (!text) return { ok: false, error: 'Empty AI response' }

      const generatedAt = new Date()
      // The patient write and the usage log are independent.
      await Promise.all([
        db.collection('patients').updateOne(
          { id: patientId, clinic_id: profile.clinic_id },
          { $set: { ai_summary: text, ai_summary_generated_at: generatedAt } }
        ),
        logRequest(db, profile, AI_REQUEST_TYPES.CLINICAL_SUMMARY, {
          patient_id: patientId,
          tokens_estimated: Math.ceil(text.length / 4),
        }),
      ])

      return { ok: true, summary: text, generated_at: generatedAt, type: 'suggest' }
    } catch (e) {
      return { ok: false, error: e.message || 'AI service error' }
    }
  }

  return withCache(cacheK, generate)
}

export async function generatePatientHistorySummary(db, profile, { patientId } = {}) {
  return generateClinicalSummary(db, profile, { patientId })
}

export async function generateTreatmentSuggestions(db, profile, { patientId } = {}) {
  const ctx = await loadPatientContext(db, profile.clinic_id, patientId)
  if (!ctx) return { ok: false, error: 'Patient not found' }

  const { patient, visits, clinical } = ctx
  const systemPrompt = `${SAFETY_PREFIX}\nSuggest possible next treatment steps based ONLY on existing notes and plans. Format as numbered suggestions. Label as "Suggested — doctor to confirm".`
  const userPrompt = `Patient: ${patient.name}\nPending plans: ${JSON.stringify(clinical.treatment_progress)}\nRecent visits:\n${buildVisitText(visits.slice(0, 5))}\n\nSuggested next treatments:`

  try {
    const text = await llmComplete(systemPrompt, userPrompt, { maxTokens: 400 })
    await logRequest(db, profile, AI_REQUEST_TYPES.TREATMENT_SUGGESTION, { patient_id: patientId })
    return { ok: true, suggestions: text, disclaimer: 'Suggestions only — doctor has final control', type: 'recommend' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function generatePrescriptionDraft(db, profile, { patientId, visitId, complaint } = {}) {
  const ctx = await loadPatientContext(db, profile.clinic_id, patientId)
  if (!ctx) return { ok: false, error: 'Patient not found' }

  const { patient, visits } = ctx
  const visit = visitId ? visits.find(v => v.id === visitId) || visits[0] : visits[0]
  const allergyWarning = patient.allergies ? `ALLERGY ALERT: ${patient.allergies}` : ''

  const systemPrompt = `${SAFETY_PREFIX}\nDraft prescription suggestions as JSON array. Include allergy warnings. Never prescribe without doctor approval.`
  const userPrompt = `${allergyWarning}\nPatient: ${patient.name}\nComplaint: ${complaint || visit?.chief_complaint || '-'}\nDiagnosis: ${visit?.diagnosis || '-'}\n\nReturn JSON: { "drafts": [{ "medicine_name", "dosage", "frequency", "duration", "instructions", "allergy_warning" }], "interaction_placeholder": "Check drug interactions manually", "duplicate_warning": null }`

  try {
    const raw = await llmComplete(systemPrompt, userPrompt, { maxTokens: 800 })
    let parsed = { drafts: [], interaction_placeholder: 'Check drug interactions manually' }
    try {
      const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      parsed.drafts = [{ medicine_name: 'Parse error — review raw', dosage: '', frequency: '', duration: '', instructions: raw.slice(0, 200) }]
    }

    if (patient.allergies) {
      parsed.allergy_warning = `Patient allergies: ${patient.allergies}`
    }

    await logRequest(db, profile, AI_REQUEST_TYPES.PRESCRIPTION_DRAFT, { patient_id: patientId, visit_id: visitId })
    return { ok: true, ...parsed, type: 'draft', disclaimer: 'Draft only — doctor must review and approve' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function generatePatientExplanation(db, profile, { patientId, topic = 'treatment' } = {}) {
  const ctx = await loadPatientContext(db, profile.clinic_id, patientId)
  if (!ctx) return { ok: false, error: 'Patient not found' }

  const { patient, visits } = ctx
  const topics = {
    treatment: 'Explain the recommended treatment in simple patient-friendly language.',
    post_treatment: 'Provide post-treatment care instructions.',
    home_care: 'Provide home care instructions.',
    recovery: 'Provide recovery guidance.',
    preventive: 'Provide preventive dental advice.',
  }

  const systemPrompt = `${SAFETY_PREFIX}\n${topics[topic] || topics.treatment} Use simple language. Include printable sections.`
  const userPrompt = `Patient: ${patient.name}\nRecent treatment: ${visits[0]?.treatment_done || visits[0]?.treatment_plan || 'general dental care'}\n\nPatient education:`

  try {
    const text = await llmComplete(systemPrompt, userPrompt, { maxTokens: 700 })
    await logRequest(db, profile, AI_REQUEST_TYPES.PATIENT_EXPLANATION, { patient_id: patientId })
    return { ok: true, explanation: text, printable: true, topic, type: 'explain' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export async function generateRecallSuggestion(db, profile, { patientId } = {}) {
  const segments = await getRecallIntelligence(db, profile.clinic_id)
  if (patientId) {
    const all = Object.values(segments.segments).flat()
    const match = all.find(p => p.id === patientId)
    return { ok: true, patient: match || null, segments: segments.segments }
  }
  await logRequest(db, profile, AI_REQUEST_TYPES.RECALL_SUGGESTION, {})
  return { ok: true, ...segments, type: 'recommend' }
}

export async function generateFollowupSuggestion(db, profile, { patientId } = {}) {
  const ctx = await loadPatientContext(db, profile.clinic_id, patientId)
  if (!ctx) return { ok: false, error: 'Patient not found' }

  const { patient, visits } = ctx
  const due = patient.next_followup_date && patient.next_followup_date <= todayIso()

  const suggestion = {
    followup_due: due,
    next_followup_date: patient.next_followup_date,
    suggested_action: due ? 'Schedule follow-up appointment' : 'No immediate follow-up required',
    last_plan: visits[0]?.treatment_plan || '',
    type: 'recommend',
  }

  await logRequest(db, profile, AI_REQUEST_TYPES.FOLLOWUP_SUGGESTION, { patient_id: patientId })
  return { ok: true, ...suggestion }
}

export async function generateAppointmentPreparation(db, profile, { appointmentId } = {}) {
  const appt = await db.collection('appointments').findOne({ id: appointmentId, clinic_id: profile.clinic_id })
  if (!appt) return { ok: false, error: 'Appointment not found' }

  const ctx = appt.patient_id ? await loadPatientContext(db, profile.clinic_id, appt.patient_id) : null
  const prep = {
    appointment: cleanDoc(appt),
    patient_snapshot: ctx ? {
      name: ctx.patient.name,
      allergies: ctx.patient.allergies,
      alerts: buildMedicalAlerts(ctx.patient),
      balance: ctx.balance,
      last_visit: ctx.visits[0]?.visit_date,
      pending_treatment: ctx.clinical.treatment_progress.pending > 0,
    } : null,
    chair_prep_notes: 'Review allergies and pending treatment before patient arrival.',
    type: 'suggest',
  }

  await logRequest(db, profile, AI_REQUEST_TYPES.APPOINTMENT_PREP, { patient_id: appt.patient_id })
  return { ok: true, ...prep }
}

export async function generateLabSummary(db, profile, { patientId } = {}) {
  const query = { clinic_id: profile.clinic_id }
  if (patientId) query.patient_id = patientId
  const labCases = await db.collection('lab_cases').find(query).sort({ created_at: -1 }).limit(20).toArray()
  const metrics = await computeLabMetrics(db, profile.clinic_id)

  const summary = {
    open_cases: labCases.filter(c => !['completed', 'delivered', 'cancelled'].includes(c.status)).length,
    cases: labCases.slice(0, 10).map(c => ({
      case_number: c.case_number,
      patient_name: c.patient_name,
      status: c.status,
      expected_delivery: c.expected_delivery_date,
    })),
    metrics,
    type: 'suggest',
  }

  await logRequest(db, profile, AI_REQUEST_TYPES.LAB_SUMMARY, { patient_id: patientId })
  return { ok: true, ...summary }
}

export async function generateInventoryInsights(db, profile) {
  const metrics = await computeInventoryMetrics(db, profile.clinic_id)
  const insights = []
  if (metrics.low_stock_count > 0) insights.push(`${metrics.low_stock_count} items low on stock`)
  if (metrics.critical_stock_count > 0) insights.push(`${metrics.critical_stock_count} critical stock alerts`)
  if (metrics.expiring_soon_count > 0) insights.push(`${metrics.expiring_soon_count} items expiring soon`)

  await logRequest(db, profile, AI_REQUEST_TYPES.INVENTORY_INSIGHT, {})
  return { ok: true, metrics, insights, type: 'recommend' }
}

export async function generateBusinessInsights(db, profile, opts = {}) {
  const kpis = await getKpis(db, profile.clinic_id, { days: opts.days || 30 })
  const insights = kpis.insights || []

  await logRequest(db, profile, AI_REQUEST_TYPES.BUSINESS_INSIGHT, {})
  return { ok: true, insights, health: kpis.health, revenue: kpis.revenue, type: 'recommend' }
}

export async function generateDoctorDailyBrief(db, profile) {
  const cid = profile.clinic_id
  const today = todayIso()

  const [appointments, followups, pendingInvoices, labMetrics, inventoryMetrics, flowMetrics] = await Promise.all([
    db.collection('appointments').find({ clinic_id: cid, appointment_date: today }).sort({ appointment_time: 1 }).toArray(),
    db.collection('patients').find({ clinic_id: cid, is_archived: { $ne: true }, next_followup_date: { $lte: today } }).limit(20).toArray(),
    db.collection('invoices').find({ clinic_id: cid, payment_status: { $in: ['pending', 'partial'] } }).limit(20).toArray(),
    computeLabMetrics(db, cid),
    computeInventoryMetrics(db, cid),
    computeFlowMetrics(db, cid, today),
  ])

  const brief = {
    date: today,
    schedule: appointments.map(a => ({ time: a.appointment_time, patient: a.patient_name || a.patient_name_temp, status: a.status })),
    followups_due: followups.length,
    pending_collections: pendingInvoices.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0),
    pending_labs: labMetrics.open_cases || 0,
    inventory_warnings: (inventoryMetrics.low_stock_count || 0) + (inventoryMetrics.critical_stock_count || 0),
    chair_preparation: flowMetrics.chairs?.filter(c => c.status === 'occupied').length || 0,
    morning_summary: `${appointments.length} appointments today, ${followups.length} follow-ups due, ${labMetrics.open_cases || 0} open lab cases.`,
    type: 'suggest',
  }

  await logRequest(db, profile, AI_REQUEST_TYPES.DOCTOR_BRIEF, {})
  return { ok: true, brief }
}

export async function generateVoiceVisitSummary(db, profile, { audioBuffer, visitId, patientId, mimeType, filename } = {}) {
  if (!audioBuffer) return { ok: false, error: 'No audio provided' }

  try {
    const key = process.env.GROQ_API_KEY
    if (!key) return { ok: false, error: 'GROQ_API_KEY not configured' }

    const groqFormData = new FormData()
    const bytes = audioBuffer instanceof Uint8Array ? audioBuffer : new Uint8Array(audioBuffer)
    const groqMime = groqMimeForAudio(mimeType, filename)
    const groqName = filenameForAudioMime(groqMime, filename)
    const audioBlob = new Blob([bytes], { type: groqMime })
    groqFormData.append('file', audioBlob, groqName)
    groqFormData.append('model', 'whisper-large-v3')
    groqFormData.append('language', 'en')

    const transcriptionResponse = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      groqFormData,
      {
        headers: { Authorization: `Bearer ${key}` },
        httpsAgent: await getGroqAgent(),
        // Audio upload plus transcription needs longer than a chat completion.
        timeout: GROQ_TIMEOUT_MS * 2,
      }
    )

    const transcript = transcriptionResponse.data.text
    const extractionPrompt = `${SAFETY_PREFIX}\nExtract structured visit data from transcript. Return JSON only with: chief_complaint, clinical_notes, diagnosis, treatment_done, treatment_plan, prescriptions (array), followup_instructions, soap_notes (subjective/objective/assessment/plan).`

    const raw = await groqChat([
      { role: 'system', content: extractionPrompt },
      { role: 'user', content: `Transcript:\n${transcript}` },
    ], 1200)

    let extracted = {}
    try {
      extracted = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim())
    } catch {
      extracted = { clinical_notes: raw, chief_complaint: transcript.slice(0, 200) }
    }

    const requestDoc = await logRequest(db, profile, AI_REQUEST_TYPES.VOICE_SUMMARY, {
      visit_id: visitId,
      patient_id: patientId,
      provider: 'groq',
      tokens_estimated: Math.ceil(transcript.length / 4),
    })

    try {
      await db.collection('ai_transcripts').insertOne({
        id: uuidv4(),
        clinic_id: profile.clinic_id,
        visit_id: visitId || null,
        patient_id: patientId || null,
        transcript,
        extracted,
        ai_request_id: requestDoc.id,
        created_at: new Date(),
      })
    } catch { /* best-effort */ }

    return {
      ok: true,
      transcript,
      extracted,
      soap_notes: extracted.soap_notes || null,
      visit_draft: {
        chief_complaint: extracted.chief_complaint || '',
        clinical_notes: extracted.clinical_notes || '',
        diagnosis: extracted.diagnosis || '',
        treatment_done: extracted.treatment_done || '',
        treatment_plan: extracted.treatment_plan || '',
        prescriptions: extracted.prescriptions || [],
        followup_instructions: extracted.followup_instructions || '',
      },
      type: 'draft',
      disclaimer: 'Draft only — doctor must review before saving',
    }
  } catch (e) {
    return { ok: false, error: mapVoiceProviderError(e, { hasGroqKey: Boolean(process.env.GROQ_API_KEY) }) }
  }
}

export async function analyzeXray(db, profile, { imageUrl } = {}) {
  if (!imageUrl) return { ok: false, error: 'Image URL required' }
  if (!isAllowedImageUrl(imageUrl)) return { ok: false, error: 'Image URL not allowed' }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY not configured' }

  try {
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) return { ok: false, error: 'Failed to fetch image' }

    const buffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(buffer).toString('base64')
    const mimeType = imageUrl.includes('.png') ? 'image/png' : imageUrl.includes('.webp') ? 'image/webp' : 'image/jpeg'

    const prompt = `${SAFETY_PREFIX}\nAnalyze this dental X-ray. Provide radiographic findings and treatment considerations. Label as "Findings for doctor review" — not a diagnosis.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Image } }] }],
        }),
      }
    )

    if (!response.ok) return { ok: false, error: 'Gemini API failed' }
    const data = await response.json()
    const findings = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No analysis available'

    await logRequest(db, profile, AI_REQUEST_TYPES.XRAY_ANALYSIS, { provider: 'gemini' })
    return { ok: true, findings, type: 'suggest', disclaimer: 'AI-assisted analysis — doctor must verify' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

/** Doctor copilot snapshot — suggestions only */
export async function getCopilotSnapshot(db, profile, { patientId } = {}) {
  const ctx = await loadPatientContext(db, profile.clinic_id, patientId)
  if (!ctx) return { ok: false, error: 'Patient not found' }

  const { patient, visits, prescriptions, balance, labCases, appointments } = ctx
  const treatmentSuggestions = await generateTreatmentSuggestions(db, profile, { patientId })

  return {
    ok: true,
    snapshot: {
      patient: { id: patient.id, name: patient.name, age: patient.age, phone: patient.phone },
      allergies: patient.allergies || null,
      medical_alerts: buildMedicalAlerts(patient),
      pending_payments: balance,
      previous_prescriptions: prescriptions.slice(0, 8),
      treatment_history: visits.slice(0, 5).map(v => ({
        date: v.visit_date,
        complaint: v.chief_complaint,
        treatment: v.treatment_done || v.treatment_plan,
      })),
      recommended_sequence: treatmentSuggestions.ok ? treatmentSuggestions.suggestions : null,
      lab_status: labCases.map(l => ({ case_number: l.case_number, status: l.status })),
      previous_complaints: visits.slice(0, 3).map(v => v.chief_complaint).filter(Boolean),
      upcoming_appointment: appointments.find(a => a.appointment_date >= todayIso()) || null,
    },
    disclaimer: 'Copilot suggestions only — doctor has final control',
    type: 'suggest',
  }
}

/** Recall intelligence — rule-based + segments */
export async function getRecallIntelligence(db, clinicId) {
  const key = cacheKey(clinicId, 'recall')
  const cached = getCached(key)
  if (cached) return cached

  const today = todayIso()
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const [patients, appointments, reviews] = await Promise.all([
    db.collection('patients').find({ clinic_id: clinicId, is_archived: { $ne: true } }).toArray(),
    db.collection('appointments').find({ clinic_id: clinicId, appointment_date: { $gte: today } }).toArray(),
    db.collection('communication_reviews').find({ clinic_id: clinicId, status: 'requested' }).toArray(),
  ])

  const apptPatientSet = new Set(appointments.map(a => a.patient_id))
  const reviewSet = new Set(reviews.map(r => r.patient_id))

  const segments = {
    recall_needed: [],
    followup_likely: [],
    inactive: [],
    high_risk: [],
    likely_cancel: [],
    review_needed: [],
  }

  for (const p of patients) {
    const entry = { id: p.id, name: p.name, phone: p.phone }
    if (p.next_followup_date && p.next_followup_date <= today) segments.followup_likely.push(entry)
    if (p.last_visit_date && new Date(p.last_visit_date) < ninetyDaysAgo) segments.inactive.push(entry)
    if (p.allergies || p.medical_history) segments.high_risk.push(entry)
    if (p.total_visits >= 3 && !apptPatientSet.has(p.id)) segments.recall_needed.push(entry)
    if (reviewSet.has(p.id)) segments.review_needed.push(entry)
  }

  const result = {
    segments,
    counts: Object.fromEntries(Object.entries(segments).map(([k, v]) => [k, v.length])),
  }
  setCache(key, result)
  return result
}

/** Prescription assistant — autocomplete from templates + AI draft */
export async function getPrescriptionAssistant(db, profile, { query, patientId } = {}) {
  const ctx = patientId ? await loadPatientContext(db, profile.clinic_id, patientId) : null
  const templates = query
    ? await db.collection('smart_typing_templates').find({
      category: 'prescriptions',
      $or: [{ clinic_id: null }, { clinic_id: profile.clinic_id }],
      trigger: { $regex: query, $options: 'i' },
    }).limit(10).toArray()
    : []

  const warnings = []
  if (ctx?.patient?.allergies) warnings.push({ type: 'allergy', message: `Allergy: ${ctx.patient.allergies}` })

  return {
    ok: true,
    autocomplete: templates.map(t => ({ trigger: t.trigger, expansion: t.expansion })),
    dosage_suggestions: ['OD', 'BD', 'TDS', 'QID', 'SOS'],
    duration_suggestions: ['3 days', '5 days', '7 days', '14 days'],
    warnings,
    interaction_placeholder: 'Drug interaction check — manual review required',
    duplicate_warning: null,
    type: 'suggest',
  }
}

/** Automation queue — prepared summaries */
export async function getAutomationQueue(db, profile) {
  const brief = await generateDoctorDailyBrief(db, profile)
  const lab = await generateLabSummary(db, profile)
  const inventory = await generateInventoryInsights(db, profile)
  const recall = await getRecallIntelligence(db, profile.clinic_id)

  await logRequest(db, profile, AI_REQUEST_TYPES.AUTOMATION, {})

  return {
    ok: true,
    queue: [
      { id: 'doctor_brief', label: 'Daily Doctor Brief', status: 'ready', data: brief.brief },
      { id: 'lab_summary', label: 'Pending Labs Summary', status: 'ready', data: lab },
      { id: 'inventory_warnings', label: 'Inventory Warnings', status: 'ready', data: inventory },
      { id: 'followups', label: 'Pending Follow-ups', status: 'ready', count: recall.counts?.followup_likely || 0 },
      { id: 'collections', label: 'Pending Collections', status: 'ready', amount: brief.brief?.pending_collections || 0 },
      { id: 'chair_prep', label: 'Chair Preparation', status: 'ready', count: brief.brief?.chair_preparation || 0 },
    ],
  }
}

/** AI Dashboard metrics */
export async function getAIDashboard(db, clinicId) {
  const key = cacheKey(clinicId, 'dashboard')
  const cached = getCached(key)
  if (cached) return cached

  const today = todayIso()
  const startOfDay = new Date(today)

  const [summariesToday, draftsPending, voiceNotes, requestsToday, byType] = await Promise.all([
    db.collection('ai_requests').countDocuments({ clinic_id: clinicId, type: AI_REQUEST_TYPES.CLINICAL_SUMMARY, created_at: { $gte: startOfDay } }),
    db.collection('ai_requests').countDocuments({ clinic_id: clinicId, type: { $in: [AI_REQUEST_TYPES.PRESCRIPTION_DRAFT, AI_REQUEST_TYPES.VOICE_SUMMARY] }, created_at: { $gte: startOfDay } }),
    db.collection('ai_transcripts').countDocuments({ clinic_id: clinicId, created_at: { $gte: startOfDay } }),
    db.collection('ai_requests').countDocuments({ clinic_id: clinicId, created_at: { $gte: startOfDay } }),
    db.collection('ai_requests').aggregate([
      { $match: { clinic_id: clinicId, created_at: { $gte: startOfDay } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).toArray(),
  ])

  const recall = await getRecallIntelligence(db, clinicId)
  const recentRequests = await db.collection('ai_requests').find({ clinic_id: clinicId }).sort({ created_at: -1 }).limit(10).project({ _id: 0, password_hash: 0 }).toArray()

  const result = {
    ok: true,
    todays_summaries: summariesToday,
    pending_drafts: draftsPending,
    voice_notes: voiceNotes,
    clinical_suggestions: recall.counts?.recall_needed || 0,
    requests_today: requestsToday,
    automation_queue_size: 6,
    by_type: Object.fromEntries(byType.map(t => [t._id, t.count])),
    recent_activity: recentRequests.map(cleanDoc),
  }
  setCache(key, result)
  return result
}

/**
 * Dashboard-safe AI summary — avoids loading all patients via getRecallIntelligence.
 * clinical_suggestions uses an indexed count approximation of recall_needed.
 */
export async function getAIDashboardLite(db, clinicId) {
  const key = cacheKey(clinicId, 'dashboard_lite')
  const cached = getCached(key)
  if (cached) return cached

  const today = todayIso()
  const startOfDay = new Date(today)

  const [summariesToday, draftsPending, voiceNotes, requestsToday, byType, upcomingPatientIds] = await Promise.all([
    db.collection('ai_requests').countDocuments({ clinic_id: clinicId, type: AI_REQUEST_TYPES.CLINICAL_SUMMARY, created_at: { $gte: startOfDay } }),
    db.collection('ai_requests').countDocuments({ clinic_id: clinicId, type: { $in: [AI_REQUEST_TYPES.PRESCRIPTION_DRAFT, AI_REQUEST_TYPES.VOICE_SUMMARY] }, created_at: { $gte: startOfDay } }),
    db.collection('ai_transcripts').countDocuments({ clinic_id: clinicId, created_at: { $gte: startOfDay } }),
    db.collection('ai_requests').countDocuments({ clinic_id: clinicId, created_at: { $gte: startOfDay } }),
    db.collection('ai_requests').aggregate([
      { $match: { clinic_id: clinicId, created_at: { $gte: startOfDay } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]).toArray(),
    db.collection('appointments').distinct('patient_id', {
      clinic_id: clinicId,
      appointment_date: { $gte: today },
    }),
  ])

  const upcomingSet = new Set((upcomingPatientIds || []).filter(Boolean))
  // Same recall_needed definition as getRecallIntelligence, without loading all patients into memory
  const recallNeeded = await db.collection('patients').countDocuments({
    clinic_id: clinicId,
    is_archived: { $ne: true },
    total_visits: { $gte: 3 },
    ...(upcomingSet.size ? { id: { $nin: [...upcomingSet] } } : {}),
  })

  const result = {
    ok: true,
    todays_summaries: summariesToday,
    pending_drafts: draftsPending,
    voice_notes: voiceNotes,
    clinical_suggestions: recallNeeded,
    requests_today: requestsToday,
    automation_queue_size: 6,
    by_type: Object.fromEntries(byType.map(t => [t._id, t.count])),
    recent_activity: [],
  }
  setCache(key, result)
  return result
}

/** Analytics metrics */
export async function computeAIMetrics(db, clinicId, range) {
  const { start, end } = range
  const query = { clinic_id: clinicId, created_at: { $gte: start, $lte: end } }

  const [total, byType, tokensAgg, clinics] = await Promise.all([
    db.collection('ai_requests').countDocuments(query),
    db.collection('ai_requests').aggregate([
      { $match: query },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('ai_requests').aggregate([
      { $match: query },
      { $group: { _id: null, tokens: { $sum: '$tokens_estimated' } } },
    ]).toArray(),
    db.collection('ai_requests').distinct('user_id', query),
  ])

  const days = Math.max(1, Math.ceil((end - start) / (24 * 3600 * 1000)))
  const topFeature = byType[0]?._id || 'clinical_summary'

  return {
    requests: total,
    tokens_estimated: tokensAgg[0]?.tokens || 0,
    unique_users: clinics.length,
    average_per_day: Math.round((total / days) * 10) / 10,
    most_used_feature: topFeature,
    by_type: Object.fromEntries(byType.map(t => [t._id, t.count])),
    summary_success_placeholder: true,
  }
}

export async function getPlatformAIAnalytics(db) {
  const key = 'platform:ai'
  const cached = getCached(key)
  if (cached) return cached

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [totalRequests, tokensAgg, byType, clinicActivity] = await Promise.all([
    db.collection('ai_requests').countDocuments({ created_at: { $gte: monthStart } }),
    db.collection('ai_requests').aggregate([
      { $match: { created_at: { $gte: monthStart } } },
      { $group: { _id: null, tokens: { $sum: '$tokens_estimated' } } },
    ]).toArray(),
    db.collection('ai_requests').aggregate([
      { $match: { created_at: { $gte: monthStart } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray(),
    db.collection('ai_requests').aggregate([
      { $match: { created_at: { $gte: monthStart } } },
      { $group: { _id: '$clinic_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]).toArray(),
  ])

  const clinics = await db.collection('clinics').find({ id: { $in: clinicActivity.map(c => c._id) } }).toArray()
  const clinicMap = Object.fromEntries(clinics.map(c => [c.id, c.name]))
  const allClinics = await db.collection('clinics').countDocuments({})
  const adoptingClinics = await db.collection('ai_requests').distinct('clinic_id', { created_at: { $gte: monthStart } })

  const result = {
    ai_usage: totalRequests,
    tokens_estimated: tokensAgg[0]?.tokens || 0,
    requests: totalRequests,
    most_used_features: byType.slice(0, 5).map(t => ({ feature: t._id, count: t.count })),
    average_summaries_per_day: Math.round(totalRequests / Math.max(1, new Date().getDate()) * 10) / 10,
    clinic_adoption_pct: allClinics ? Math.round((adoptingClinics.length / allClinics) * 1000) / 10 : 0,
    top_clinics: clinicActivity.map(c => ({ clinic_id: c._id, name: clinicMap[c._id] || c._id, requests: c.count })),
  }
  setCache(key, result)
  return result
}

export function clearAICache(clinicId) {
  if (!clinicId) { cache.clear(); return }
  for (const k of cache.keys()) {
    if (k.startsWith(`${clinicId}:`)) cache.delete(k)
  }
}

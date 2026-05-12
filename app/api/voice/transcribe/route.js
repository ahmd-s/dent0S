/** DentOS — Whisper transcription + Claude JSON extraction for visit voice notes. */
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDb } from '@/lib/mongo'
import { createAnthropicMessage } from '@/lib/anthropic-messages'

export const runtime = 'nodejs'
export const maxDuration = 120

const clinicalAccess = p => p?.role === 'admin' || p?.role === 'doctor'

const EMPTY_FIELDS = () => ({
  chief_complaint: '',
  clinical_notes: '',
  diagnosis: '',
  treatment_done: '',
  prescriptions: [],
})

function buildExtractionPrompt(transcript) {
  return `You are a medical documentation assistant for a dental clinic in India. Your job is to organize the doctor's spoken notes into structured fields. You do NOT diagnose or invent clinical facts.

Rules:
- Output VALID JSON ONLY. No markdown, no code fences, no commentary before or after the JSON.
- Use professional English for all string values. If the doctor spoke Hindi, Hinglish, or mixed language, translate faithfully into clear clinical English while preserving medical meaning. Do not add information not implied by the transcript.
- If something was not mentioned, use an empty string "" or for prescriptions an empty array [].
- Do NOT invent medication names, doses, diagnoses, or treatments. If uncertain, leave blank.
- prescriptions: array of objects with keys medicine_name, dosage, frequency, duration, instructions (all strings). Only include entries where the doctor clearly named a medicine. frequency should be a short code if mentioned (e.g. BD, TDS); else "".

Required JSON shape (fill values from transcript only):
{"chief_complaint":"","clinical_notes":"","diagnosis":"","treatment_done":"","prescriptions":[{"medicine_name":"","dosage":"","frequency":"","duration":"","instructions":""}]}

Transcript (doctor dictation):
---
${transcript}
---

Respond with the JSON object only.`
}

function safeParseExtraction(text) {
  let t = (text || '').trim()
  if (!t) return null
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z0-9]*\s*/m, '').replace(/\s*```$/m, '')
  }
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  t = t.slice(start, end + 1)
  try {
    const o = JSON.parse(t)
    const base = EMPTY_FIELDS()
    base.chief_complaint = typeof o.chief_complaint === 'string' ? o.chief_complaint : ''
    base.clinical_notes = typeof o.clinical_notes === 'string' ? o.clinical_notes : ''
    base.diagnosis = typeof o.diagnosis === 'string' ? o.diagnosis : ''
    base.treatment_done = typeof o.treatment_done === 'string' ? o.treatment_done : ''
    if (Array.isArray(o.prescriptions)) {
      base.prescriptions = o.prescriptions
        .filter(p => p && typeof p === 'object')
        .map(p => ({
          medicine_name: String(p.medicine_name || '').trim(),
          dosage: String(p.dosage || '').trim(),
          frequency: String(p.frequency || '').trim(),
          duration: String(p.duration || '').trim(),
          instructions: String(p.instructions || '').trim(),
        }))
        .filter(p => p.medicine_name)
    }
    return base
  } catch {
    return null
  }
}

export async function POST(request) {
  try {
    const token = getCurrentUser()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ id: token.uid })
    if (!profile?.clinic_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!clinicalAccess(profile)) {
      return NextResponse.json({ error: 'Voice documentation is only available to clinical staff' }, { status: 403 })
    }

    let formData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('audio')
    const visitId = String(formData.get('visit_id') || '').trim()
    if (!visitId) return NextResponse.json({ error: 'visit_id is required' }, { status: 400 })
    if (!file || typeof file === 'string' || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    const visit = await db.collection('visits').findOne({ id: visitId, clinic_id: profile.clinic_id })
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 })

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'Voice transcription is not configured (OPENAI_API_KEY)' }, { status: 503 })
    }

    const anthropicKey = process.env.EMERGENT_LLM_KEY || process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'Structured extraction is not configured (ANTHROPIC_API_KEY)' }, { status: 503 })
    }

    const maxBytes = 22 * 1024 * 1024
    const size = typeof file.size === 'number' ? file.size : (await file.arrayBuffer()).byteLength
    if (!size) return NextResponse.json({ error: 'Empty audio file' }, { status: 400 })
    if (size > maxBytes) {
      return NextResponse.json({ error: 'Recording is too large. Please record a shorter clip.' }, { status: 400 })
    }

    const whisperForm = new FormData()
    const uploadName =
      file instanceof File && file.name
        ? file.name
        : file.type?.includes('mp4')
          ? 'recording.m4a'
          : 'recording.webm'
    whisperForm.append('file', file, uploadName)
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('response_format', 'json')

    const wController = new AbortController()
    const wTimer = setTimeout(() => wController.abort(), 90_000)
    let whisperRes
    try {
      whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: whisperForm,
        signal: wController.signal,
      })
    } catch (e) {
      if (e.name === 'AbortError') {
        return NextResponse.json({ error: 'Transcription timed out. Try a shorter recording.' }, { status: 504 })
      }
      return NextResponse.json({ error: 'Could not reach transcription service' }, { status: 502 })
    } finally {
      clearTimeout(wTimer)
    }

    if (!whisperRes.ok) {
      return NextResponse.json({ error: 'Transcription failed. Check audio format or try again.' }, { status: 502 })
    }

    let whisperJson
    try {
      whisperJson = await whisperRes.json()
    } catch {
      return NextResponse.json({ error: 'Invalid transcription response' }, { status: 502 })
    }

    const transcript = (whisperJson.text || '').trim()
    if (!transcript) {
      return NextResponse.json({ error: 'No speech detected in the recording' }, { status: 400 })
    }

    let extractedText
    try {
      extractedText = await createAnthropicMessage({
        max_tokens: 2048,
        messages: [{ role: 'user', content: buildExtractionPrompt(transcript) }],
      })
    } catch {
      return NextResponse.json(
        { error: 'Could not structure notes from transcript. You can still type manually.', transcript },
        { status: 502 }
      )
    }

    const fields = safeParseExtraction(extractedText)
    if (!fields) {
      return NextResponse.json(
        { error: 'Could not parse structured fields. Transcript is still available.', transcript },
        { status: 502 }
      )
    }

    return NextResponse.json({ transcript, fields })
  } catch (e) {
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

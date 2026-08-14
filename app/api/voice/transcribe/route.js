import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, enforceRateLimit } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { generateVoiceVisitSummary } from '@/lib/ai-engine'
import { validateFileUpload } from '@/lib/security'
import { filenameForAudioMime, groqMimeForAudio, isAllowedVoiceAudioType, mapVoiceProviderError, normalizeAudioMime } from '@/lib/voice-audio'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    if (!canAccessClinical(ctx.profile)) return err('Forbidden', 403)

    const rate = await enforceRateLimit(request, ctx.profile.id)
    if (!rate.allowed) return err('Rate limit exceeded. Try again later.', 429)

    const formData = await request.formData()
    const audioFile = formData.get('audio')
    if (!audioFile || typeof audioFile.arrayBuffer !== 'function') return err('No audio file provided', 400)

    const visitId = formData.get('visit_id')?.toString() || null
    if (!visitId) return err('visit_id is required', 400)

    const visit = await ctx.db.collection('visits').findOne({ id: visitId, clinic_id: ctx.profile.clinic_id })
    if (!visit) return err('Visit not found', 404)

    const originalName = audioFile.name || 'recording.webm'
    const mimeType = groqMimeForAudio(audioFile.type, originalName)
    if (!isAllowedVoiceAudioType(mimeType, originalName)) {
      return err('This audio format is not supported. Record again in Safari or Chrome.', 400)
    }

    const fileValidation = validateFileUpload({
      mimeType: normalizeAudioMime(mimeType, originalName) || mimeType,
      sizeBytes: audioFile.size,
      allowedTypes: [
        'audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4',
        'audio/ogg', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mp4a-latm',
        'video/webm', 'video/mp4',
      ],
      maxBytes: 25 * 1024 * 1024,
    })
    if (!fileValidation.ok) return err(fileValidation.error, 400)

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const patientId = formData.get('patient_id')?.toString() || visit.patient_id || null

    const result = await generateVoiceVisitSummary(ctx.db, ctx.profile, {
      audioBuffer,
      visitId,
      patientId,
      mimeType,
      filename: filenameForAudioMime(mimeType, originalName),
    })

    if (!result.ok) {
      return err(mapVoiceProviderError(result.error, { hasGroqKey: Boolean(process.env.GROQ_API_KEY) }), 502)
    }

    return json({
      transcript: result.transcript,
      extracted: result.extracted,
      visit_draft: result.visit_draft,
      soap_notes: result.soap_notes,
      disclaimer: result.disclaimer,
    })
  } catch (e) {
    console.error('Voice transcribe error:', e?.name || 'Error')
    return err('Internal server error', 500)
  }
}

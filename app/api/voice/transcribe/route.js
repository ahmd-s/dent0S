import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, enforceRateLimit } from '@/lib/api-helpers'
import { canAccessClinical } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { generateVoiceVisitSummary } from '@/lib/ai-engine'
import { validateFileUpload } from '@/lib/security'

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
    if (!audioFile) return err('No audio file provided', 400)

    const fileValidation = validateFileUpload({
      mimeType: audioFile.type || 'audio/webm',
      sizeBytes: audioFile.size,
      allowedTypes: ['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg'],
      maxBytes: 25 * 1024 * 1024,
    })
    if (!fileValidation.ok) return err(fileValidation.error, 400)

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
    const visitId = formData.get('visit_id')?.toString() || null
    const patientId = formData.get('patient_id')?.toString() || null

    const result = await generateVoiceVisitSummary(ctx.db, ctx.profile, {
      audioBuffer,
      visitId,
      patientId,
    })

    if (!result.ok) return err(result.error || 'Voice processing failed', 502)

    return json({
      transcript: result.transcript,
      extracted: result.extracted,
      visit_draft: result.visit_draft,
      soap_notes: result.soap_notes,
      disclaimer: result.disclaimer,
    })
  } catch (e) {
    console.error('Voice transcribe error:', e)
    return err('Internal server error', 500)
  }
}

import { v2 as cloudinary } from 'cloudinary'
import { requireUser, json, err } from '@/lib/api-helpers'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { uploadBuffer } from '@/lib/localStorage'
import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

export const dynamic = 'force-dynamic'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)

    const { profile, db } = ctx
    const cid = profile.clinic_id

    const formData = await request.formData()
    const file = formData.get('file')
    const patientId = formData.get('patient_id')
    const visitId = formData.get('visit_id') || null
    const description = formData.get('description') || ''

    if (!file || !patientId) return err('File and patient_id required', 400)

    const patient = await db.collection('patients').findOne({ id: patientId, clinic_id: cid })
    if (!patient) return err('Not found', 404)

    if (file.size > 10 * 1024 * 1024) {
      return err('File too large. Maximum size is 10MB', 400)
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const folder = `dentos/${cid}/${patientId}`

    let uploadResult
    if (process.env.APP_MODE === 'local') {
      uploadResult = uploadBuffer(buffer, file.name, folder)
    } else {
      uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'auto',
            allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        ).end(buffer)
      })
    }

    const doc = {
      patient_id: patientId,
      visit_id: visitId,
      clinic_id: cid,
      file_name: file.name,
      file_url: uploadResult.secure_url,
      file_type: uploadResult.resource_type,
      file_format: uploadResult.format,
      file_size: file.size,
      public_id: uploadResult.public_id,
      uploaded_by: profile.id,
      description,
      uploaded_at: new Date(),
    }
    const result = await db.collection('documents').insertOne(doc)
    doc._id = result.insertedId

    await logActivity(db, profile, ACTIVITY_EVENTS.DOCUMENT_UPLOADED, {
      patientId,
      visitId,
      metadata: { file_name: file.name },
    })

    return json({ document: doc })
  } catch (error) {
    console.error('Upload error:', error)
    return err('Upload failed', 500)
  }
}

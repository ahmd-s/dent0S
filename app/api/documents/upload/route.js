import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { isClinicAccessBlocked, CLINIC_ACCESS_PAUSED_MESSAGE } from '@/lib/clinic-access'
import { uploadBuffer } from '@/lib/localStorage'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request) {
  try {
    const user = getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const db = await getDb()
    const profile = await db.collection('profiles').findOne({ id: user.uid })
    const clinic = profile?.clinic_id
      ? await db.collection('clinics').findOne({ id: profile.clinic_id })
      : null
    if (isClinicAccessBlocked(clinic)) {
      return NextResponse.json(
        { error: CLINIC_ACCESS_PAUSED_MESSAGE, code: 'CLINIC_ACCESS_PAUSED' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const patientId = formData.get('patient_id')
    const visitId = formData.get('visit_id') || null
    const description = formData.get('description') || ''

    if (!file || !patientId) {
      return NextResponse.json(
        { error: 'File and patient_id required' },
        { status: 400 }
      )
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let uploadResult;

    if (process.env.APP_MODE === 'local') {
      // Use local file system
      uploadResult = uploadBuffer(buffer, file.name, `dentos/${user.clinic_id}/${patientId}`);
    } else {
      // Existing Cloudinary logic
      uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `dentos/${user.clinic_id}/${patientId}`,
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
      clinic_id: user.clinic_id,
      file_name: file.name,
      file_url: uploadResult.secure_url,
      file_type: uploadResult.resource_type,
      file_format: uploadResult.format,
      file_size: file.size,
      public_id: uploadResult.public_id,
      uploaded_by: user.id,
      description,
      uploaded_at: new Date(),
    }
    const result = await db.collection('documents').insertOne(doc)
    doc._id = result.insertedId

    return NextResponse.json({ document: doc })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
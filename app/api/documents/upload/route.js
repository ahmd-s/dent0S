import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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

    const uploadResult = await new Promise((resolve, reject) => {
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

    const db = await getDb()
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
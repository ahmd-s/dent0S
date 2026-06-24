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
    const user = {
        clinic_id: 'test-clinic'
      }

    
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `dentos/${user.clinic_id}/logo`,
          resource_type: 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      ).end(buffer)
    })

    const db = await getDb()

    await db.collection('clinics').updateOne(
      { id: user.clinic_id },
      {
        $set: {
          logo_url: uploadResult.secure_url,
          updated_at: new Date(),
        },
      }
    )

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url,
    })

  } catch (error) {
    console.error('Logo upload error:', error)

    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}
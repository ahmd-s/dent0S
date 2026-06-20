import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { ObjectId } from 'mongodb'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const visitId = searchParams.get('visit_id')

    if (!patientId && !visitId) {
      return NextResponse.json(
        { error: 'patient_id or visit_id required' },
        { status: 400 }
      )
    }

    const db = await getDb()
    let query = { clinic_id: user.clinic_id }
    
    if (visitId) {
      // Fetch documents for a specific visit
      query.visit_id = visitId
    } else if (patientId) {
      // Fetch all documents for a patient (includes both patient-uploaded and visit-uploaded docs)
      query.patient_id = patientId
    }
    
    const documents = await db
      .collection('documents')
      .find(query)
      .sort({ uploaded_at: -1 })
      .toArray()

    return NextResponse.json({ documents })

  } catch (error) {
    console.error('Fetch documents error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('id')

    if (!docId) {
      return NextResponse.json(
        { error: 'Document id required' },
        { status: 400 }
      )
    }

    const db = await getDb()
    const doc = await db.collection('documents').findOne({
      _id: new ObjectId(docId),
      clinic_id: user.clinic_id,
    })

    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(doc.public_id, {
      resource_type: doc.file_type === 'pdf' ? 'raw' : 'image'
    })

    // Delete from MongoDB
    await db.collection('documents').deleteOne({
      _id: new ObjectId(docId)
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete document error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
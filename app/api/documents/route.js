import { ObjectId } from 'mongodb'
import { v2 as cloudinary } from 'cloudinary'
import { requireUser, json, err } from '@/lib/api-helpers'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { logActivity } from '@/lib/activity-helpers'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'

export const dynamic = 'force-dynamic'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)

    const { searchParams } = new URL(request.url)
    const patientId = searchParams.get('patient_id')
    const visitId = searchParams.get('visit_id')

    if (!patientId && !visitId) {
      return err('patient_id or visit_id required', 400)
    }

    const query = { clinic_id: ctx.profile.clinic_id }
    if (visitId) query.visit_id = visitId
    else query.patient_id = patientId

    const documents = await ctx.db
      .collection('documents')
      .find(query)
      .sort({ uploaded_at: -1 })
      .toArray()

    return json({ documents })
  } catch (error) {
    console.error('Fetch documents error:', error)
    return err('Failed to fetch documents', 500)
  }
}

export async function DELETE(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)

    const { searchParams } = new URL(request.url)
    const docId = searchParams.get('id')
    if (!docId) return err('Document id required', 400)

    const cid = ctx.profile.clinic_id
    const doc = await ctx.db.collection('documents').findOne({
      _id: new ObjectId(docId),
      clinic_id: cid,
    })
    if (!doc) return err('Document not found', 404)

    await cloudinary.uploader.destroy(doc.public_id, {
      resource_type: doc.file_type === 'pdf' ? 'raw' : 'image',
    })

    await ctx.db.collection('documents').deleteOne({
      _id: new ObjectId(docId),
      clinic_id: cid,
    })

    await logActivity(ctx.db, ctx.profile, ACTIVITY_EVENTS.DOCUMENT_DELETED, {
      patientId: doc.patient_id,
      visitId: doc.visit_id,
      metadata: { file_name: doc.file_name },
    })

    return json({ success: true })
  } catch (error) {
    console.error('Delete document error:', error)
    return err('Failed to delete document', 500)
  }
}

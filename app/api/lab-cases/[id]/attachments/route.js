import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { requireUser, json, err, cors, isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/api-helpers'
import { logAudit, AUDIT_ACTIONS, AUDIT_SOURCE } from '@/lib/audit'
import { uploadBuffer } from '@/lib/localStorage'
import fs from 'fs'
import path from 'path'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function POST(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const lc = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    if (!lc) return err('Lab case not found', 404)

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('File required')
    if (!ALLOWED.includes(file.type)) return err('Only JPG, PNG and PDF files are allowed')
    if (file.size > 10 * 1024 * 1024) return err('File too large. Maximum size is 10MB')

    const buffer = Buffer.from(await file.arrayBuffer())
    let uploadResult;

    if (process.env.APP_MODE === 'local') {
      uploadResult = uploadBuffer(buffer, file.name, `dentos/${cid}/lab-cases/${params.id}`);
    } else {
      uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: `dentos/${cid}/lab-cases/${params.id}`, resource_type: 'auto', allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'] },
          (error, result) => { if (error) reject(error); else resolve(result) }
        ).end(buffer)
      })
    }

    const attachment = {
      id: uuidv4(),
      file_name: file.name,
      file_url: uploadResult.secure_url,
      file_type: uploadResult.resource_type,
      file_format: uploadResult.format || '',
      file_size: file.size,
      public_id: uploadResult.public_id,
      category: formData.get('category') || '',
      uploaded_by: profile.id,
      uploaded_by_name: profile.full_name || '',
      uploaded_at: new Date(),
    }
    await db.collection('lab_cases').updateOne({ id: params.id, clinic_id: cid }, { $push: { attachments: attachment }, $set: { updated_at: new Date() } })
    await logAudit(db, { clinicId: cid, labCaseId: lc.id, caseNumber: lc.case_number, action: AUDIT_ACTIONS.FILE_UPLOADED, source: AUDIT_SOURCE.CLINIC, actorId: profile.id, actorName: profile.full_name || '', meta: { file_name: file.name } })
    return json({ ok: true, attachment })
  } catch (e) {
    console.error('Lab case attachment POST error:', e)
    return err('Upload failed', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const attachmentId = new URL(request.url).searchParams.get('attachment_id')
    if (!attachmentId) return err('attachment_id required')
    const lc = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    if (!lc) return err('Lab case not found', 404)
    const att = (lc.attachments || []).find(a => a.id === attachmentId)
    if (!att) return err('Attachment not found', 404)

    try {
      if (process.env.APP_MODE === 'local') {
        const extension = path.extname(att.file_name) || ''
        const fullPath = path.join(process.cwd(), 'local-uploads', att.public_id + extension)
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath)
        }
      } else {
        await cloudinary.uploader.destroy(att.public_id, { resource_type: att.file_type === 'image' ? 'image' : 'raw' })
      }
    } catch (e) {
      console.error('File destroy error:', e)
    }
    await db.collection('lab_cases').updateOne({ id: params.id, clinic_id: cid }, { $pull: { attachments: { id: attachmentId } }, $set: { updated_at: new Date() } })
    await logAudit(db, { clinicId: cid, labCaseId: lc.id, caseNumber: lc.case_number, action: AUDIT_ACTIONS.FILE_DELETED, source: AUDIT_SOURCE.CLINIC, actorId: profile.id, actorName: profile.full_name || '', meta: { file_name: att.file_name } })
    return json({ ok: true })
  } catch (e) {
    console.error('Lab case attachment DELETE error:', e)
    return err('Delete failed', 500)
  }
}

import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { uploadBuffer } from '@/lib/localStorage'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp']

export async function POST(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    const { profile, db } = ctx
    if (!hasPermission(profile, 'settings', 'update')) return err('Forbidden', 403)

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('No file uploaded')
    if (file.size > MAX_SIZE_BYTES) return err('Image must be under 5MB')

    const buffer = Buffer.from(await file.arrayBuffer())
    const cid = profile.clinic_id

    let uploadResult;

    if (process.env.APP_MODE === 'local') {
      uploadResult = uploadBuffer(buffer, file.name, `dentos/${cid}/logo`);
    } else {
      uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `dentos/${cid}/logo`,
            resource_type: 'image',
            allowed_formats: ALLOWED_FORMATS,
          },
          (error, result) => {
            if (error) reject(error)
            else resolve(result)
          }
        ).end(buffer)
      })
    }

    await db.collection('clinics').updateOne(
      { id: cid },
      { $set: { logo_url: uploadResult.secure_url, updated_at: new Date() } }
    )

    return json({ ok: true, url: uploadResult.secure_url })
  } catch (error) {
    console.error('Clinic logo upload error:', error)
    return err('Upload failed', 500)
  }
}

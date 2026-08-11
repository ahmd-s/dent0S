import { NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { getDb } from '@/lib/mongo'
import { cors } from '@/lib/api-helpers'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s = 400) => json({ error: msg }, s)

function isStlFile(file) {
  if (!file || typeof file === 'string') return false
  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()
  return name.endsWith('.stl') || type === 'model/stl' || type === 'application/sla' || type === 'application/vnd.ms-pki.stl'
}

import { addStlFile } from '@/lib/lab-workflow-engine'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

// PUBLIC (no auth). Accepts an STL upload for a lab case via its unguessable token.
export async function POST(request, { params }) {
  try {
    const token = params.token
    if (!token) return err('Invalid link', 404)

    const db = await getDb()
    const lc = await db.collection('lab_cases').findOne({ stl_upload_token: token })
    if (!lc) return err('Lab case not found', 404)

    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) return err('File required')
    if (!isStlFile(file)) return err('Only .stl files are allowed')

    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: 'dentos_stl_files',
          resource_type: 'raw',
          public_id: `${lc.id}_${Date.now()}`,
        },
        (error, result) => { if (error) reject(error); else resolve(result) }
      ).end(buffer)
    })

    await addStlFile(db, null, lc, {
      file_name: file.name || 'scan.stl',
      file_url: uploadResult.secure_url,
      file_size: buffer.length,
      uploaded_by_name: 'Public Upload',
    })

    return json({ ok: true, message: 'File uploaded successfully' })
  } catch (e) {
    console.error('Public lab-upload POST error:', e)
    return err('Upload failed', 500)
  }
}

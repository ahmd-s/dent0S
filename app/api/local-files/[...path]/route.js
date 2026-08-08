import fs from 'fs'
import path from 'path'
import { getCurrentUser } from '@/lib/auth'
import { getDb } from '@/lib/mongo'

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  return { profile, db }
}

export async function GET(request, { params }) {
  // Only available in local development mode
  if (process.env.APP_MODE !== 'local') {
    return new Response('Not found', { status: 404 })
  }

  // Require authentication
  const ctx = await requireUser()
  if (!ctx) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { profile } = ctx
  const clinic_id = profile.clinic_id

  const pathSegments = params.path

  // Reject traversal attempts: no segment may be empty, '.', or '..'
  for (const seg of pathSegments) {
    if (!seg || seg === '.' || seg === '..' || seg.includes('\0')) {
      return new Response('Not found', { status: 404 })
    }
  }

  // Uploaded files are stored under local-uploads/dentos/{clinic_id}/...
  // The URL path served is /api/local-files/dentos/{clinic_id}/{patientId}/{filename}
  // Verify the clinic_id segment matches the authenticated user's clinic
  const EXPECTED_PREFIX = 'dentos'
  if (pathSegments[0] !== EXPECTED_PREFIX || pathSegments[1] !== clinic_id) {
    return new Response('Not found', { status: 404 })
  }

  // Resolve and normalise the absolute path
  const localUploadsRoot = path.join(process.cwd(), 'local-uploads')
  const absolutePath = path.join(localUploadsRoot, ...pathSegments)

  // Final traversal guard: resolved path must still be inside local-uploads root
  if (!absolutePath.startsWith(localUploadsRoot + path.sep) && absolutePath !== localUploadsRoot) {
    return new Response('Not found', { status: 404 })
  }

  if (!fs.existsSync(absolutePath)) {
    return new Response('Not found', { status: 404 })
  }

  const buffer = fs.readFileSync(absolutePath)

  const extension = path.extname(absolutePath).toLowerCase()
  let contentType = 'application/octet-stream'
  switch (extension) {
    case '.jpg':
    case '.jpeg': contentType = 'image/jpeg'; break
    case '.png':  contentType = 'image/png';  break
    case '.gif':  contentType = 'image/gif';  break
    case '.webp': contentType = 'image/webp'; break
    case '.pdf':  contentType = 'application/pdf'; break
    case '.svg':  contentType = 'image/svg+xml'; break
    default:      contentType = 'application/octet-stream'
  }

  return new Response(buffer, {
    headers: { 'Content-Type': contentType }
  })
}

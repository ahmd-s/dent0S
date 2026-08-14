import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export async function GET(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    
    const { profile, db } = user
    const cid = profile.clinic_id
    
    const templates = await db.collection('consent_templates')
      .find({ clinic_id: cid })
      .sort({ created_at: -1 })
      .toArray()
    
    return json({ templates: templates.map(clean) })
  } catch (error) {
    console.error('Consent templates API error:', error)
    return err('Internal server error', 500)
  }
}

export async function POST(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(user.clinic)) return clinicAccessPausedResponse(err)
    
    const { profile, db } = user
    const cid = profile.clinic_id
    
    if (!hasPermission(profile, 'consent_templates', 'create')) return err('Forbidden', 403)
    
    const b = await request.json()
    if (!b.name || !b.content) return err('Name and content required')
    if (!b.category || !['Treatment', 'Photography', 'Data Privacy', 'General'].includes(b.category)) {
      return err('Invalid category')
    }
    
    const id = uuidv4()
    const now = new Date()
    
    await db.collection('consent_templates').insertOne({
      id,
      clinic_id: cid,
      name: b.name,
      category: b.category,
      content: b.content,
      active: b.active !== undefined ? b.active : true,
      created_at: now,
      updated_at: now
    })
    
    return json({ ok: true, id })
  } catch (error) {
    console.error('Consent template creation error:', error)
    return err('Internal server error', 500)
  }
}

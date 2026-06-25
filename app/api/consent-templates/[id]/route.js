import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

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
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function PUT(request, { params }) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    
    const { profile, db } = user
    const cid = profile.clinic_id
    
    if (!hasPermission(profile.role, 'consent_templates', 'update')) return err('Forbidden', 403)
    
    const b = await request.json()
    const { id } = params
    
    const existing = await db.collection('consent_templates').findOne({ id, clinic_id: cid })
    if (!existing) return err('Template not found', 404)
    
    const updateData = {
      updated_at: new Date()
    }
    
    if (b.name !== undefined) updateData.name = b.name
    if (b.category !== undefined) {
      if (!['Treatment', 'Photography', 'Data Privacy', 'General'].includes(b.category)) {
        return err('Invalid category')
      }
      updateData.category = b.category
    }
    if (b.content !== undefined) updateData.content = b.content
    if (b.active !== undefined) updateData.active = b.active
    
    await db.collection('consent_templates').updateOne(
      { id, clinic_id: cid },
      { $set: updateData }
    )
    
    return json({ ok: true })
  } catch (error) {
    console.error('Consent template update error:', error)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    
    const { profile, db } = user
    const cid = profile.clinic_id
    
    if (!hasPermission(profile.role, 'consent_templates', 'delete')) return err('Forbidden', 403)
    
    const { id } = params
    
    const result = await db.collection('consent_templates').deleteOne({ id, clinic_id: cid })
    
    if (result.deletedCount === 0) return err('Template not found', 404)
    
    return json({ ok: true })
  } catch (error) {
    console.error('Consent template deletion error:', error)
    return err('Internal server error', 500)
  }
}

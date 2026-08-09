import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import slugify from 'slugify'
import { getDb } from '@/lib/mongo'
import { hashPassword } from '@/lib/auth'
import { createTrial } from '@/lib/subscription-engine'
import { createDefaultWorkspace } from '@/lib/workspace-engine'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

export async function POST(request) {
  try {
    const db = await getDb()
    const b = await request.json()
    const required = ['full_name','email','phone','clinic_name','password']
    if (required.some(k=>!b[k])) return err('Missing fields')
    const email = b.email.toLowerCase().trim()
    if (await db.collection('profiles').findOne({ email })) return err('Email already registered')
    const userId = uuidv4(), clinicId = uuidv4()
    const slug = slugify(b.clinic_name, { lower: true, strict: true }) + '-' + Math.floor(1000+Math.random()*9000)
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    await db.collection('clinics').insertOne({
      id: clinicId, name: b.clinic_name, slug, owner_id: userId, phone: b.phone, address:'', city:'', gstin:'', logo_url:'', working_hours:null,
      subscription_plan:'free', is_active:true, onboarding_complete:false, subscription_status:'active', monthly_ai_usage_limit:null,
      trial_ends_at: trialEnd, subscription_exempt: false, trial_auto_enforcement: 'auto', created_at: now,
    })
    await db.collection('profiles').insertOne({
      id: userId,
      clinic_id: clinicId,
      email,
      password_hash: await hashPassword(b.password),
      full_name: b.full_name,
      role: 'admin',
      phone: b.phone,
      is_active: true,
      email_verified: true,
      created_at: new Date(),
    })
    await createTrial(db, clinicId, { trialEnd, createdAt: now })
    await createDefaultWorkspace(db, clinicId)
    return json({ ok: true })
  } catch (e) {
    console.error('Auth signup error:', e)
    return err('Internal server error', 500)
  }
}

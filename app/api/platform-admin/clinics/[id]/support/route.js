import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical']
const VALID_STATUSES = ['open', 'in_progress', 'resolved']
const VALID_NOTE_TYPES = ['note', 'issue', 'feature_request', 'call_log']

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const [support, notes] = await Promise.all([
      db.collection('clinic_support').findOne({ clinic_id: params.id }),
      db.collection('clinic_support_notes')
        .find({ clinic_id: params.id })
        .sort({ created_at: -1 })
        .limit(100)
        .toArray(),
    ])

    return json({
      support: support ? (({ _id, ...rest }) => rest)(support) : null,
      notes: notes.map(({ _id, ...rest }) => rest),
    })
  } catch (e) {
    console.error('Support GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request, { params }) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const clinic = await db.collection('clinics').findOne({ id: params.id })
    if (!clinic) return notFound()

    const body = await request.json().catch(() => ({}))
    const action = body.action || 'add_note'

    if (action === 'add_note') {
      const type = body.type || 'note'
      if (!VALID_NOTE_TYPES.includes(type)) {
        return json({ error: `type must be one of: ${VALID_NOTE_TYPES.join(', ')}` }, 400)
      }
      const content = String(body.content || '').trim()
      if (!content) return json({ error: 'content is required' }, 400)

      const note = {
        id: uuidv4(),
        clinic_id: params.id,
        type,
        content,
        author_id: profile.id,
        author_email: profile.email,
        created_at: new Date(),
      }
      await db.collection('clinic_support_notes').insertOne(note)

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.SUPPORT_NOTE_ADDED,
        targetClinicId: params.id,
        targetClinicName: clinic.name,
        meta: { type, content: content.slice(0, 80) },
      })

      const { _id, ...clean } = note
      return json({ ok: true, note: clean })
    }

    if (action === 'update_metadata') {
      const update = {}
      if (body.priority !== undefined) {
        if (!VALID_PRIORITIES.includes(body.priority)) {
          return json({ error: `priority must be one of: ${VALID_PRIORITIES.join(', ')}` }, 400)
        }
        update.priority = body.priority
      }
      if (body.status !== undefined) {
        if (!VALID_STATUSES.includes(body.status)) {
          return json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` }, 400)
        }
        update.status = body.status
      }
      if (body.assigned_engineer !== undefined) update.assigned_engineer = String(body.assigned_engineer).trim() || null
      if (body.next_followup_at !== undefined) update.next_followup_at = body.next_followup_at ? new Date(body.next_followup_at) : null
      if (body.last_call_at !== undefined) update.last_call_at = body.last_call_at ? new Date(body.last_call_at) : null
      if (body.contact_email !== undefined) update.contact_email = String(body.contact_email).trim() || null

      update.updated_at = new Date()

      await db.collection('clinic_support').updateOne(
        { clinic_id: params.id },
        {
          $set: { clinic_id: params.id, ...update },
          $setOnInsert: { created_at: new Date() },
        },
        { upsert: true }
      )

      await logPlatformAudit(db, {
        actor: profile,
        action: AUDIT_ACTIONS.SUPPORT_METADATA_UPDATED,
        targetClinicId: params.id,
        targetClinicName: clinic.name,
        meta: update,
      })

      return json({ ok: true })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    console.error('Support POST error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

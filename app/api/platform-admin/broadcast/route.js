import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requirePlatformAdmin, logPlatformAudit, AUDIT_ACTIONS } from '@/lib/platform-admin'
import { createPlatformNotification } from '@/lib/platform-notifications'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))
const notFound = () => cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { db } = ctx

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    const broadcasts = await db.collection('broadcasts')
      .find({})
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray()

    return json({
      broadcasts: broadcasts.map(({ _id, ...rest }) => rest),
    })
  } catch (e) {
    console.error('Broadcast GET error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

export async function POST(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return notFound()
    const { profile, db } = ctx

    const body = await request.json().catch(() => ({}))
    const {
      recipients_filter,  // 'all' | 'trial' | 'grace' | 'blocked' | 'selected'
      clinic_ids = [],
      channel,            // 'dashboard' | 'email' | 'whatsapp'
      template,
      subject,
      body: messageBody,
    } = body

    if (!recipients_filter) return json({ error: 'recipients_filter is required' }, 400)
    if (!channel) return json({ error: 'channel is required' }, 400)
    if (!messageBody || !String(messageBody).trim()) return json({ error: 'body is required' }, 400)

    const VALID_FILTERS = ['all', 'trial', 'grace', 'blocked', 'active', 'selected']
    if (!VALID_FILTERS.includes(recipients_filter)) {
      return json({ error: `recipients_filter must be one of: ${VALID_FILTERS.join(', ')}` }, 400)
    }

    const VALID_CHANNELS = ['dashboard', 'email', 'whatsapp']
    if (!VALID_CHANNELS.includes(channel)) {
      return json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` }, 400)
    }

    // Resolve recipient clinic IDs
    let targetClinics = []

    if (recipients_filter === 'selected') {
      if (!clinic_ids.length) return json({ error: 'clinic_ids required for selected filter' }, 400)
      targetClinics = await db.collection('clinics')
        .find({ id: { $in: clinic_ids } })
        .project({ id: 1, name: 1 })
        .toArray()
    } else {
      const clinicQuery = {}
      if (recipients_filter === 'blocked') clinicQuery.subscription_status = 'blocked'
      else if (recipients_filter !== 'all') {
        // For trial/grace/active we need to join with subscriptions
        const subQuery = {}
        if (recipients_filter === 'trial') subQuery.subscription_status = 'trial'
        else if (recipients_filter === 'grace') subQuery.subscription_status = 'halted'
        else if (recipients_filter === 'active') subQuery.subscription_status = 'active'

        const subs = await db.collection('subscriptions')
          .find(subQuery)
          .project({ clinic_id: 1 })
          .toArray()
        const ids = subs.map(s => s.clinic_id)
        clinicQuery.id = { $in: ids }
      }
      targetClinics = await db.collection('clinics')
        .find(clinicQuery)
        .project({ id: 1, name: 1 })
        .toArray()
    }

    const broadcastDoc = {
      id: uuidv4(),
      created_by_id: profile.id,
      created_by_email: profile.email,
      recipients_filter,
      recipient_clinic_ids: targetClinics.map(c => c.id),
      channel,
      template: template || null,
      subject: subject || null,
      body: messageBody,
      delivered_count: targetClinics.length,
      created_at: new Date(),
    }

    await db.collection('broadcasts').insertOne(broadcastDoc)

    // For dashboard channel: create a platform notification for each clinic
    if (channel === 'dashboard') {
      for (const clinic of targetClinics) {
        await createPlatformNotification(db, {
          type: 'broadcast_sent',
          clinicId: clinic.id,
          clinicName: clinic.name,
          meta: {
            subject: subject || 'Platform Message',
            body: String(messageBody).slice(0, 200),
            channel,
          },
        })
      }
    }

    await logPlatformAudit(db, {
      actor: profile,
      action: AUDIT_ACTIONS.BROADCAST_SENT,
      targetClinicId: null,
      targetClinicName: null,
      meta: {
        recipients_filter,
        channel,
        delivered_count: targetClinics.length,
        subject: subject || null,
        template: template || null,
      },
    })

    const { _id, ...clean } = broadcastDoc
    return json({ ok: true, broadcast: clean, delivered_count: targetClinics.length })
  } catch (e) {
    console.error('Broadcast POST error:', e)
    return cors(NextResponse.json({ error: 'Internal server error' }, { status: 500 }))
  }
}

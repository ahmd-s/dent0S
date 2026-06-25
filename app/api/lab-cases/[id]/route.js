import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'
import { LAB_CASE_STATUSES, safeIsoDate, populateNames, secureToken } from '@/lib/lab-case-helpers'
import { logAudit, AUDIT_ACTIONS, AUDIT_SOURCE } from '@/lib/audit'
import { canManageInventory } from '@/lib/rbac'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const lc = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    if (!lc) return err('Lab case not found', 404)
    // Backfill a secure token for cases created before the lab-portal workflow.
    if (!lc.public_token) {
      lc.public_token = secureToken()
      await db.collection('lab_cases').updateOne({ id: params.id, clinic_id: cid }, { $set: { public_token: lc.public_token } })
      await logAudit(db, { clinicId: cid, labCaseId: lc.id, caseNumber: lc.case_number, action: AUDIT_ACTIONS.LINK_GENERATED, source: AUDIT_SOURCE.SYSTEM, actorId: profile.id, actorName: profile.full_name || '' })
    }
    const enriched = await populateNames(db, cid, clean(lc))
    return json({ lab_case: enriched })
  } catch (e) {
    console.error('Lab case GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canManageInventory(profile.role)) return err('Forbidden', 403)
    const b = await request.json()
    const lc = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    if (!lc) return err('Lab case not found', 404)

    const update = { updated_at: new Date() }
    const ops = { $set: update }

    // Status workflow + timeline tracking
    let statusChanged = null
    if ('status' in b && b.status !== lc.status) {
      if (!LAB_CASE_STATUSES.includes(b.status)) return err('Invalid status')
      update.status = b.status
      statusChanged = b.status
      ops.$push = {
        timeline: {
          status: b.status,
          note: b.status_note || '',
          by: profile.id,
          by_name: profile.full_name || '',
          source: AUDIT_SOURCE.CLINIC,
          at: new Date(),
        },
      }
    }

    // Editable fields
    for (const k of ['case_type', 'tooth_numbers', 'shade', 'material', 'description', 'urgency']) {
      if (k in b) update[k] = b[k]
    }
    if ('vendor_id' in b && b.vendor_id) {
      const vendor = await db.collection('vendors').findOne({ id: b.vendor_id, clinic_id: cid })
      if (!vendor) return err('Selected vendor not found', 404)
      update.vendor_id = b.vendor_id
    }
    if ('expected_delivery_date' in b) update.expected_delivery_date = safeIsoDate(b.expected_delivery_date)

    await db.collection('lab_cases').updateOne({ id: params.id, clinic_id: cid }, ops)
    if (statusChanged) {
      await logAudit(db, { clinicId: cid, labCaseId: lc.id, caseNumber: lc.case_number, action: AUDIT_ACTIONS.STATUS_UPDATED, source: AUDIT_SOURCE.CLINIC, actorId: profile.id, actorName: profile.full_name || '', meta: { status: statusChanged, note: b.status_note || '' } })
    }
    const fresh = await db.collection('lab_cases').findOne({ id: params.id, clinic_id: cid })
    const enriched = await populateNames(db, cid, clean(fresh))
    return json({ ok: true, lab_case: enriched })
  } catch (e) {
    console.error('Lab case PUT error:', e)
    return err('Internal server error', 500)
  }
}

export async function DELETE(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    if (!canManageInventory(profile.role)) return err('Forbidden', 403)
    const r = await db.collection('lab_cases').deleteOne({ id: params.id, clinic_id: cid })
    if (!r.deletedCount) return err('Lab case not found', 404)
    return json({ ok: true })
  } catch (e) {
    console.error('Lab case DELETE error:', e)
    return err('Internal server error', 500)
  }
}

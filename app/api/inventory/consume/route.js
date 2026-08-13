import { NextResponse } from 'next/server'
import { requireUser, json, err, cors, isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/api-helpers'
import { consumeStockFifo, applyTreatmentConsumption, InventoryFlowError } from '@/lib/inventory-workflow-engine'
import { ACTIVITY_EVENTS } from '@/lib/activity-event-registry'
import { logActivity } from '@/lib/activity-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function POST(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    if (isClinicAccessBlocked(ctx.clinic)) return clinicAccessPausedResponse(err)
    const { profile, db } = ctx; const cid = profile.clinic_id

    const b = await request.json()
    if (!b.visit_id) return err('Visit ID is required')
    if (!b.patient_name) return err('Patient name is required')
    if (!b.items || !Array.isArray(b.items) || b.items.length === 0) return err('Items array is required')

    const visit = await db.collection('visits').findOne({ id: b.visit_id, clinic_id: cid })
    if (!visit) return err('Not found', 404)

    const validItems = b.items.filter(item =>
      item.item_id && item.quantity && Number(item.quantity) > 0
    )

    if (validItems.length === 0) {
      return json({ ok: true, consumed: [], warnings: [] })
    }

    const consumed = []
    const warnings = []

    for (const itemReq of validItems) {
      const item = await db.collection('inventory_items').findOne({ id: itemReq.item_id, clinic_id: cid })
      if (!item) {
        warnings.push({ item_id: itemReq.item_id, message: 'Item not found' })
        continue
      }

      try {
        const result = await consumeStockFifo(db, profile, item, itemReq.quantity, {
          auto: true,
          visit_id: b.visit_id,
          patient_id: visit.patient_id,
          patient_name: b.patient_name,
          treatment_name: b.treatment_name || visit.treatment_done || '',
          notes: b.notes || '',
        })
        consumed.push({
          item_id: itemReq.item_id,
          item_name: item.item_name,
          quantity: itemReq.quantity,
          stock_before: result.stock_before,
          stock_after: result.stock_after,
        })
        for (const w of result.warnings || []) {
          warnings.push({ item_id: itemReq.item_id, item_name: item.item_name, message: w })
        }
      } catch (e) {
        if (e instanceof InventoryFlowError) {
          warnings.push({ item_id: itemReq.item_id, item_name: item.item_name, message: e.message })
        } else throw e
      }
    }

    if (b.apply_template && (b.treatment_name || visit.treatment_done)) {
      const autoResult = await applyTreatmentConsumption(db, profile, {
        treatment_name: b.treatment_name || visit.treatment_done,
        visit_id: b.visit_id,
        patient_id: visit.patient_id,
        patient_name: b.patient_name,
      })
      for (const c of autoResult.consumed || []) {
        if (!consumed.find(x => x.item_id === c.item_id)) consumed.push(c)
      }
      warnings.push(...(autoResult.warnings || []))
    }

    if (consumed.length) {
      await logActivity(db, profile, ACTIVITY_EVENTS.INVENTORY_CONSUMED, {
        patientId: visit.patient_id,
        visitId: b.visit_id,
        metadata: { patient_name: b.patient_name, items: consumed.map(c => c.item_name), count: consumed.length },
      })
    }

    const { invalidateClinicDashboard } = await import('@/lib/dashboard-invalidation')
    invalidateClinicDashboard(cid, 'inventory')
    return json({ ok: true, consumed, warnings })
  } catch (e) {
    console.error('Consume error:', e)
    return err('Internal server error', 500)
  }
}

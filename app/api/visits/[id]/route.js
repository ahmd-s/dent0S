import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import {
  hasPermission,
  canViewClinical,
  canAccessClinical,
  canManageBilling,
  filterPatientFields,
} from '@/lib/rbac'
import { getProfileRoles, hasRole } from '@/lib/profile-roles'
import {
  assertDoctorOwnsVisit,
  assertDoctorOwnsPatient,
  doctorVisitFilter,
} from '@/lib/doctor-scope'
import {
  initVisitWorkflowFields,
  bothStepsResolved,
  deriveWorkflowStatus,
  ensureVisitWorkflow,
  STEP_SKIPPED,
  STEP_DONE,
  STEP_ASSIGNED,
} from '@/lib/visit-completion'
import { isClinicAccessBlocked, clinicAccessPausedResponse } from '@/lib/clinic-access'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, password_hash, ...rest } = o; return rest }
const todayIso = () => new Date().toISOString().slice(0,10)
const initials = name => (name||'').split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,3) || 'CL'

async function requireUser() {
  const t = getCurrentUser(); if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

async function upsertInvoice(db, clinic, cid, visit, b) {
  let invoiceId = null
  if (!Array.isArray(b.invoice_items) && !b.invoice) return null
  const existing = await db.collection('invoices').findOne({ visit_id: visit.id, clinic_id: cid })
  const items = (b.invoice_items||[]).filter(it => it.description?.trim())
  const subtotal = items.reduce((s,it)=> s + (parseFloat(it.unit_price)||0)*(parseInt(it.quantity)||1), 0)
  const discount = parseFloat(b.discount)||0
  const gst = b.gst_enabled ? Math.round((subtotal-discount)*0.18*100)/100 : 0
  const total = Math.max(0, subtotal - discount + gst)
  const invoiceData = {
    subtotal, discount, gst_amount: gst, total_amount: total,
    payment_status: b.payment_status||'pending',
    payment_mode: b.payment_mode||null,
    notes: b.invoice_notes||'',
  }
  if (existing) {
    await db.collection('invoices').updateOne({ id: existing.id }, { $set: invoiceData })
    await db.collection('invoice_items').deleteMany({ invoice_id: existing.id, clinic_id: cid })
    invoiceId = existing.id
  } else {
    if (isClinicAccessBlocked(clinic)) return { accessPaused: true }
    invoiceId = uuidv4()
    const count = await db.collection('invoices').countDocuments({ clinic_id: cid })
    const invoice_number = `INV-${initials(clinic.name)}-${String(count+1).padStart(5,'0')}`
    const share_token = uuidv4()
    await db.collection('invoices').insertOne({
      id: invoiceId, clinic_id: cid, patient_id: visit.patient_id, visit_id: visit.id,
      invoice_number, invoice_date: todayIso(), share_token, ...invoiceData, created_at: new Date(),
    })
  }
  if (items.length) {
    await db.collection('invoice_items').insertMany(items.map(it => ({
      id: uuidv4(), clinic_id: cid, invoice_id: invoiceId,
      description: it.description, quantity: parseInt(it.quantity)||1,
      unit_price: parseFloat(it.unit_price)||0,
      total: (parseFloat(it.unit_price)||0)*(parseInt(it.quantity)||1),
    })))
  }
  return invoiceId
}

async function finalizeVisit(db, cid, visit, b) {
  if (!visit.chief_complaint && !b.chief_complaint) return err('Chief complaint required to complete')
  if (visit?.appointment_id) {
    await db.collection('appointments').updateOne(
      { id: visit.appointment_id, clinic_id: cid },
      { $set: { status: 'completed' } }
    )
  }
  await db.collection('patients').updateOne(
    { id: visit.patient_id, clinic_id: cid },
    {
      $set: {
        last_visit_date: visit.visit_date,
        next_followup_date: b.next_visit_recommended ? b.next_visit_date : null,
      },
      $inc: { total_visits: 1 },
    }
  )
  await db.collection('visits').updateOne(
    { id: visit.id, clinic_id: cid },
    { $set: { workflow_status: 'completed', status: 'completed' } }
  )
  return null
}

export async function GET(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    if (!canViewClinical(profile)) return err('Forbidden', 403)
    let v = await db.collection('visits').findOne({ id: params.id, clinic_id: cid })
    if (!v) return err('Not found', 404)
    if (!await assertDoctorOwnsVisit(db, cid, roles, profile.id, v)) return err('Forbidden', 403)
    v = ensureVisitWorkflow(v)
    const [p, doc, rxs, prevList, inv] = await Promise.all([
      db.collection('patients').findOne({ id: v.patient_id, clinic_id: cid }),
      v.doctor_id ? db.collection('profiles').findOne({ id: v.doctor_id, clinic_id: cid }) : null,
      db.collection('prescriptions').find({ visit_id: v.id, clinic_id: cid }).toArray(),
      db.collection('visits').find({ patient_id: v.patient_id, clinic_id: cid, id: { $ne: v.id } }).sort({ visit_date: -1, created_at: -1 }).limit(1).toArray(),
      db.collection('invoices').findOne({ visit_id: v.id, clinic_id: cid }),
    ])
    const items = inv ? await db.collection('invoice_items').find({ invoice_id: inv.id, clinic_id: cid }).toArray() : []
    const { items: _invItems, ...cleanInv } = inv ? clean(inv) : {}
    const { prescriptions: _vRx, ...cleanV } = clean(v)
    return json({
      visit: {
        ...cleanV,
        patient: filterPatientFields(clean(p), roles),
        doctor_name: doc?.full_name||'',
        doctor_consultation_fee: doc?.consultation_fee ?? null,
        prescriptions: rxs.map(clean),
        previous_visit: prevList[0] ? clean(prevList[0]) : null,
        invoice: inv ? { ...cleanInv, items: items.map(clean) } : null,
      },
    })
  } catch (e) {
    console.error('Visit GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PUT(request, { params }) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, clinic, db } = ctx; const cid = profile.clinic_id
    const roles = getProfileRoles(profile)
    const b = await request.json()
    let visit = await db.collection('visits').findOne({ id: params.id, clinic_id: cid })
    if (!visit) return err('Not found', 404)
    if (!await assertDoctorOwnsVisit(db, cid, roles, profile.id, visit)) return err('Forbidden', 403)
    visit = ensureVisitWorkflow(visit)

    const update = {}
    let inventoryStep = { ...visit.inventory_step }
    let invoiceStep = { ...visit.invoice_step }
    let invoiceId = null

    const canEditClinicalFields = canAccessClinical(profile) &&
      (!hasRole(roles, 'doctor') || visit.doctor_id === profile.id || hasRole(roles, 'admin'))

    // ── Clinical step save ──────────────────────────────────────────────
    if (b.save_clinical) {
      if (!canEditClinicalFields) return err('Forbidden', 403)
      const clinicalKeys = ['chief_complaint','clinical_notes','diagnosis','treatment_done','treatment_plan','next_visit_recommended','next_visit_date']
      for (const k of clinicalKeys) if (k in b) update[k] = b[k]
      if (Array.isArray(b.prescriptions)) {
        await db.collection('prescriptions').deleteMany({ visit_id: params.id, clinic_id: cid })
        const valid = b.prescriptions.filter(r => r.medicine_name?.trim())
        if (valid.length) {
          await db.collection('prescriptions').insertMany(valid.map(r => ({
            id: uuidv4(), clinic_id: cid, visit_id: params.id,
            medicine_name: r.medicine_name, dosage: r.dosage||'', frequency: r.frequency||'',
            duration: r.duration||'', instructions: r.instructions||'', created_at: new Date(),
          })))
        }
      }
      update.clinical_saved_at = new Date()
      update.workflow_status = 'inventory'
    } else if (b.complete === false) {
      // Draft autosave during clinical step only
      if (canEditClinicalFields && (visit.workflow_status === 'clinical' || !visit.clinical_saved_at)) {
        const clinicalKeys = ['chief_complaint','clinical_notes','diagnosis','treatment_done','treatment_plan','next_visit_recommended','next_visit_date']
        for (const k of clinicalKeys) if (k in b) update[k] = b[k]
        if (Array.isArray(b.prescriptions)) {
          await db.collection('prescriptions').deleteMany({ visit_id: params.id, clinic_id: cid })
          const valid = b.prescriptions.filter(r => r.medicine_name?.trim())
          if (valid.length) {
            await db.collection('prescriptions').insertMany(valid.map(r => ({
              id: uuidv4(), clinic_id: cid, visit_id: params.id,
              medicine_name: r.medicine_name, dosage: r.dosage||'', frequency: r.frequency||'',
              duration: r.duration||'', instructions: r.instructions||'', created_at: new Date(),
            })))
          }
        }
      }
    }

    // ── Inventory step ────────────────────────────────────────────────────
    if (b.inventory_action) {
      const action = b.inventory_action
      if (action === 'skip' && canEditClinicalFields) {
        inventoryStep = { status: STEP_SKIPPED, assigned_to: null, completed_at: new Date() }
      } else if (action === 'done' && (canEditClinicalFields || inventoryStep.status === STEP_ASSIGNED)) {
        inventoryStep = { status: STEP_DONE, assigned_to: null, completed_at: new Date() }
      } else if (action === 'assign' && canEditClinicalFields) {
        inventoryStep = { status: STEP_ASSIGNED, assigned_to: null, completed_at: null }
      } else {
        return err('Forbidden', 403)
      }
      update.inventory_step = inventoryStep
      update.workflow_status = deriveWorkflowStatus(inventoryStep, invoiceStep)
    }

    // ── Invoice step ──────────────────────────────────────────────────────
    const canEditInvoice =
      canManageBilling(profile) ||
      (invoiceStep.status === STEP_ASSIGNED && hasRole(roles, 'receptionist'))

    if (b.invoice_action) {
      if (!canEditInvoice && !canEditClinicalFields) return err('Forbidden', 403)
      const action = b.invoice_action
      if (action === 'assign' && canEditClinicalFields) {
        invoiceStep = { status: STEP_ASSIGNED, assigned_to: null, completed_at: null }
      } else if (action === 'done') {
        invoiceStep = { status: STEP_DONE, assigned_to: null, completed_at: new Date() }
      } else {
        return err('Invalid invoice action', 400)
      }
      update.invoice_step = invoiceStep
      update.workflow_status = deriveWorkflowStatus(inventoryStep, invoiceStep)
    }

    if ((canEditInvoice || canEditClinicalFields) && (Array.isArray(b.invoice_items) || b.invoice)) {
      if (!canEditInvoice && invoiceStep.status !== STEP_ASSIGNED) {
        if (!canEditClinicalFields || visit.workflow_status === 'clinical') {
          // skip invoice during clinical-only draft
        } else if (!canEditInvoice) {
          return err('Forbidden', 403)
        }
      }
      if (canEditInvoice || (canEditClinicalFields && visit.workflow_status !== 'clinical')) {
        const upsertResult = await upsertInvoice(db, clinic, cid, visit, b)
        if (upsertResult?.accessPaused) return clinicAccessPausedResponse(err)
        invoiceId = upsertResult
      }
    }

    if (Object.keys(update).length) {
      await db.collection('visits').updateOne({ id: params.id, clinic_id: cid }, { $set: update })
      visit = { ...visit, ...update }
    }

    const invStep = update.inventory_step || inventoryStep
    const invcStep = update.invoice_step || invoiceStep

    if (b.complete || bothStepsResolved(invStep, invcStep)) {
      if (!bothStepsResolved(invStep, invcStep)) {
        return err('Inventory and invoice steps must be resolved before completing', 400)
      }
      const finErr = await finalizeVisit(db, cid, { ...visit, ...update }, b)
      if (finErr) return finErr
    }

    return json({ ok: true, invoice_id: invoiceId, workflow_status: visit.workflow_status })
  } catch (e) {
    console.error('Visit PUT error:', e)
    return err('Internal server error', 500)
  }
}

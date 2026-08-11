import { NextResponse } from 'next/server'
import { requireUser, json, err, cors } from '@/lib/api-helpers'
import { buildVendorDashboard } from '@/lib/lab-workflow-engine'
import { buildSupplierInventoryDashboard } from '@/lib/inventory-workflow-engine'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/vendors/[id]/dashboard — vendor performance dashboard */
export async function GET(request, { params }) {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)

  const [labData, supplierData] = await Promise.all([
    buildVendorDashboard(ctx.db, ctx.profile.clinic_id, params.id),
    buildSupplierInventoryDashboard(ctx.db, ctx.profile.clinic_id, params.id),
  ])
  if (!labData && !supplierData) return err('Vendor not found', 404)
  return json({ ok: true, ...(labData || {}), supplier: supplierData })
}

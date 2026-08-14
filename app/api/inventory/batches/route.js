import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

/** GET /api/inventory/batches?item_id= — batch history for an item */
export async function GET(request) {
  try {
    const ctx = await requireUser()
    if (!ctx) return err('Unauthorized', 401)

    const url = new URL(request.url)
    const itemId = url.searchParams.get('item_id')
    const f = { clinic_id: ctx.profile.clinic_id }
    if (itemId) f.item_id = itemId

    const batches = await ctx.db.collection('inventory_batches')
      .find(f)
      .sort({ purchase_date: -1, created_at: -1 })
      .toArray()

    return json({ ok: true, batches: batches.map(clean) })
  } catch (e) {
    console.error('Batches GET error:', e)
    return err('Internal server error', 500)
  }
}

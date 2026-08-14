import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { MASTER_CATALOG, MASTER_TREATMENTS } from '@/lib/master-catalog-seed'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const db = ctx.db

    // Check if master_catalog already has documents
    const existingCatalog = await db.collection('master_catalog').countDocuments()
    if (existingCatalog > 0) {
      return NextResponse.json({ ok: true, message: 'Already seeded' })
    }

    // Prepare catalog items with IDs and timestamps
    const catalogItems = MASTER_CATALOG.map(item => ({
      id: uuidv4(),
      item_name: item.item_name,
      category: item.category,
      unit: item.unit,
      common_uses: item.common_uses,
      created_at: new Date()
    }))

    // Prepare treatment items with IDs and timestamps
    const treatmentItems = MASTER_TREATMENTS.map(treatment => ({
      id: uuidv4(),
      treatment_name: treatment.treatment_name,
      category: treatment.category,
      suggested_materials: treatment.suggested_materials,
      created_at: new Date()
    }))

    // Insert into collections (global, no clinic_id)
    await db.collection('master_catalog').insertMany(catalogItems)
    await db.collection('master_treatments').insertMany(treatmentItems)

    return NextResponse.json({
      ok: true,
      seeded_items: catalogItems.length,
      seeded_treatments: treatmentItems.length
    })
  } catch (error) {
    console.error('Error seeding master catalog:', error)
    return NextResponse.json({ error: 'Failed to seed catalog' }, { status: 500 })
  }
}

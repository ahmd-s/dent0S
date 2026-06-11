import { NextResponse } from 'next/server'
import { requireUser, json, err, clean, cors } from '@/lib/api-helpers'

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request) {
  try {
    const ctx = await requireUser(); if (!ctx) return err('Unauthorized', 401)
    const { profile, db } = ctx; const cid = profile.clinic_id
    const url = new URL(request.url)
    
    const itemId = url.searchParams.get('item_id')
    const movementType = url.searchParams.get('movement_type')
    const dateFrom = url.searchParams.get('date_from')
    const dateTo = url.searchParams.get('date_to')
    const page = parseInt(url.searchParams.get('page') || '1')
    const pageSize = parseInt(url.searchParams.get('page_size') || '20')
    
    const f = { clinic_id: cid }
    if (itemId) f.item_id = itemId
    if (movementType) f.movement_type = movementType
    if (dateFrom || dateTo) {
      f.created_at = {}
      if (dateFrom) f.created_at.$gte = new Date(dateFrom)
      if (dateTo) f.created_at.$lte = new Date(dateTo)
    }
    
    const [result] = await db.collection('stock_movements').aggregate([
      { $match: f },
      { $facet: {
          data: [
            { $sort: { created_at: -1 } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize }
          ],
          totalCount: [
            { $count: 'total' }
          ]
      }}
    ]).toArray()
    
    const movements = result?.data || []
    const totalCount = result?.totalCount?.[0]?.total || 0
    const totalPages = Math.ceil(totalCount / pageSize)
    
    return json({ 
      movements: movements.map(clean), 
      pagination: {
        page,
        page_size: pageSize,
        total_count: totalCount,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1
      }
    })
  } catch (e) {
    console.error('Movements GET error:', e)
    return err('Internal server error', 500)
  }
}

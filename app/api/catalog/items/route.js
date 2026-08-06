export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

export async function GET(request) {
  const db = await getDb()
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const category = url.searchParams.get('category') || ''
  const filter = {}
  if (q) filter.item_name = { $regex: q, $options: 'i' }
  if (category) filter.category = category
  const items = await db.collection('master_catalog').find(filter).limit(10).toArray()
  
  const res = NextResponse.json({ items: items.map(clean) })
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

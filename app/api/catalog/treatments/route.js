import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

export async function GET(request) {
  const db = await getDb()
  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const filter = q ? { treatment_name: { $regex: q, $options: 'i' } } : {}
  const treatments = await db.collection('master_treatments').find(filter).limit(15).toArray()
  
  const res = NextResponse.json({ treatments: treatments.map(clean) })
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

export async function GET() {
  const timestamp = new Date().toISOString()
  const environment = process.env.NODE_ENV || 'development'

  try {
    const db = await getDb()
    await db.command({ ping: 1 })

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        environment,
        timestamp,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        environment,
        timestamp,
      },
      { status: 503 }
    )
  }
}

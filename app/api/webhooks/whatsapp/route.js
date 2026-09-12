import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import {
  handleWhatsAppWebhookGet,
  handleWhatsAppWebhookAuth,
  parseWhatsAppWebhookPayload,
  applyWhatsAppCloudStatuses,
} from '@/lib/communication'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const result = await handleWhatsAppWebhookGet(new URL(request.url))
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return new NextResponse(result.challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

export async function POST(request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const auth = handleWhatsAppWebhookAuth(rawBody, signature)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    const db = await getDb()
    const { statuses } = parseWhatsAppWebhookPayload(body)
    const results = await applyWhatsAppCloudStatuses(db, statuses)
    return NextResponse.json({ ok: true, processed: results.filter(r => r.ok && !r.skipped).length })
  } catch (e) {
    console.error('WhatsApp webhook error:', e?.message || e)
    // Meta retries on non-2xx; acknowledge so a lookup blip does not storm the endpoint.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}

import { NextResponse } from 'next/server'
import { requirePlatformAdmin } from '@/lib/platform-admin'
import { collectRazorpayAccount } from '@/lib/razorpay-platform'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}
const json = (d, s = 200) => cors(NextResponse.json(d, { status: s }))

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

export async function GET() {
  try {
    const ctx = await requirePlatformAdmin()
    if (!ctx) return cors(NextResponse.json({ error: 'Not found' }, { status: 404 }))
    const data = await collectRazorpayAccount(ctx.db)
    return json(data)
  } catch (e) {
    console.error('Platform admin Razorpay error:', e)
    return json({
      configured: false,
      dashboard_url: 'https://dashboard.razorpay.com/app/payments',
      kpis: {},
      payments: [],
      subscriptions: [],
      error: 'Unable to load Razorpay account',
    })
  }
}

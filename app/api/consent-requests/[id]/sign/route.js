import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { headers } from 'next/headers'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

export async function POST(request, { params }) {
  try {
    const db = await getDb()
    const { id } = params
    const headersList = headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'
    
    const b = await request.json()
    
    if (!b.signature_image) return err('Signature image required')
    if (!b.patient_name) return err('Patient name required')
    if (!b.agreed) return err('You must agree to the consent terms')
    
    const consentRequest = await db.collection('consent_requests').findOne({ unique_token: id })
    if (!consentRequest) return err('Consent request not found', 404)
    
    // Check if expired
    if (new Date() > new Date(consentRequest.expires_at)) {
      return err('Consent request has expired', 410)
    }
    
    // Check if already signed
    if (consentRequest.status === 'Signed') {
      return err('This consent has already been signed', 409)
    }
    
    // Update consent request with signature
    await db.collection('consent_requests').updateOne(
      { unique_token: id },
      {
        $set: {
          status: 'Signed',
          signed_at: new Date(),
          signature_image: b.signature_image,
          patient_name: b.patient_name,
          ip_address: ip
        }
      }
    )
    
    return json({ ok: true, message: 'Consent signed successfully' })
  } catch (error) {
    console.error('Consent signing error:', error)
    return err('Internal server error', 500)
  }
}

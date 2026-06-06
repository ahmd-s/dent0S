import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)
const clean = o => { if (!o) return o; const { _id, ...rest } = o; return rest }

export async function GET(request, { params }) {
  try {
    const db = await getDb()
    const { id } = params
    
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
    
    // Get template and clinic info
    const template = await db.collection('consent_templates').findOne({ id: consentRequest.template_id })
    const clinic = await db.collection('clinics').findOne({ id: consentRequest.clinic_id })
    
    return json({
      consent_request: clean(consentRequest),
      template: template ? clean(template) : null,
      clinic: clinic ? clean(clinic) : null
    })
  } catch (error) {
    console.error('Consent request fetch error:', error)
    return err('Internal server error', 500)
  }
}

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  if (!profile) return null
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}

export async function GET(request) {
  try {
    const user = await requireUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const { profile, db } = user
    const cid = profile.clinic_id
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    
    if (!id) return NextResponse.json({ error: 'ID parameter required' }, { status: 400 })
    
    const consentRequest = await db.collection('consent_requests').findOne({ id, clinic_id: cid })
    if (!consentRequest) return NextResponse.json({ error: 'Consent request not found' }, { status: 404 })
    
    if (consentRequest.status !== 'Signed') {
      return NextResponse.json({ error: 'Consent must be signed to generate PDF' }, { status: 400 })
    }
    
    const template = await db.collection('consent_templates').findOne({ id: consentRequest.template_id, clinic_id: cid })
    const clinic = await db.collection('clinics').findOne({ id: consentRequest.clinic_id })
    const patient = await db.collection('patients').findOne({ id: consentRequest.patient_id, clinic_id: cid })
    
    // Generate HTML for PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Consent Form - ${template?.name || 'Consent'}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0D9488; padding-bottom: 20px; }
    .clinic-name { font-size: 24px; font-weight: bold; color: #0D9488; }
    .consent-title { font-size: 20px; font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
    .consent-content { line-height: 1.6; margin-bottom: 30px; white-space: pre-wrap; }
    .info-section { margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px; }
    .info-row { margin: 10px 0; }
    .info-label { font-weight: bold; }
    .signature-section { margin-top: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
    .signature-image { max-width: 200px; max-height: 100px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <div class="clinic-name">${clinic?.name || 'Dental Clinic'}</div>
    <div>${clinic?.address || ''}</div>
    <div>${clinic?.phone || ''}</div>
  </div>
  
  <div class="consent-title">${template?.name || 'Consent Form'}</div>
  <div class="consent-content">${template?.content || ''}</div>
  
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">Patient Name:</span> ${consentRequest.patient_name || patient?.name || 'N/A'}
    </div>
    <div class="info-row">
      <span class="info-label">Date Signed:</span> ${new Date(consentRequest.signed_at).toLocaleDateString()}
    </div>
    <div class="info-row">
      <span class="info-label">Consent ID:</span> ${consentRequest.id}
    </div>
  </div>
  
  <div class="signature-section">
    <div class="info-label">Patient Signature:</div>
    <img src="${consentRequest.signature_image}" class="signature-image" alt="Signature" />
  </div>
  
  <div class="footer">
    This document was generated electronically by DentOS on ${new Date().toLocaleString()}
  </div>
</body>
</html>
    `
    
    // Return HTML as response (browser can print to PDF)
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...cors(NextResponse.json({})).headers
      }
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

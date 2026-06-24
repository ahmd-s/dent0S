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

export async function OPTIONS() { return cors(new NextResponse(null, { status: 200 })) }

export async function GET(request, { params }) {
  try {
    const db = await getDb()
    const caseNumber = params.caseNumber.toUpperCase()
    
    const labCase = await db.collection('lab_cases').findOne({ case_number: caseNumber })
    
    if (!labCase) {
      return err('Lab case not found', 404)
    }
    
    return json({
      lab_case: {
        case_number: labCase.case_number,
        status: labCase.status,
        case_type: labCase.case_type,
        expected_delivery_date: labCase.expected_delivery_date,
        patient_id: labCase.patient_id,
        vendor_id: labCase.vendor_id
      }
    })
  } catch (e) {
    console.error('Lab case GET error:', e)
    return err('Internal server error', 500)
  }
}

export async function PATCH(request, { params }) {
  try {
    const db = await getDb()
    const caseNumber = params.caseNumber.toUpperCase()
    const body = await request.json()
    
    const allowedStatuses = ['pending', 'sent', 'lab_received', 'in_production', 'ready', 'delivered', 'completed', 'cancelled']
    
    if (!body.status || !allowedStatuses.includes(body.status)) {
      return err('Invalid status', 400)
    }
    
    const labCase = await db.collection('lab_cases').findOne({ case_number: caseNumber })
    
    if (!labCase) {
      return err('Lab case not found', 404)
    }
    
    await db.collection('lab_cases').updateOne(
      { case_number: caseNumber },
      {
        $set: {
          status: body.status,
          updated_at: new Date()
        },
        $push: {
          timeline: {
            status: body.status,
            note: `Status updated via ${body.updated_via || 'whatsapp'}`,
            by: 'system',
            by_name: 'WhatsApp Bot',
            source: 'whatsapp',
            at: new Date()
          }
        }
      }
    )
    
    const updatedDoc = await db.collection('lab_cases').findOne({ case_number: caseNumber })
    
    return json({ ok: true, lab_case: updatedDoc })
  } catch (e) {
    console.error('Lab case PATCH error:', e)
    return err('Internal server error', 500)
  }
}

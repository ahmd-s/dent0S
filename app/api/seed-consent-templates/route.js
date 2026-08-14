import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongo'
import { getCurrentUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { loadUserContext } from '@/lib/auth-context'

// Reads cookies/headers per request, so it can never be statically rendered.
export const dynamic = 'force-dynamic'

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

const json = (d, s=200) => cors(NextResponse.json(d, { status: s }))
const err = (msg, s=400) => json({ error: msg }, s)

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const DEFAULT_TEMPLATES = [
  {
    name: 'General Treatment Consent',
    category: 'Treatment',
    content: `GENERAL TREATMENT CONSENT FORM

I, __________________________, hereby consent to dental treatment as recommended by the dentist.

I understand that:
1. The dentist has explained the nature of the proposed treatment, including the risks, benefits, and alternatives.
2. I have had the opportunity to ask questions and all my questions have been answered to my satisfaction.
3. The treatment may involve the use of local anesthesia, dental instruments, and materials.
4. There may be risks associated with dental treatment including but not limited to infection, bleeding, nerve damage, and allergic reactions.
5. The final outcome cannot be guaranteed.
6. I may withdraw my consent at any time by notifying the dentist.

I authorize the dentist and their staff to perform the necessary dental treatment.

Patient Signature: _____________________ Date: _____________

Witness Signature: ____________________ Date: _____________`
  },
  {
    name: 'Root Canal Treatment Consent',
    category: 'Treatment',
    content: `ROOT CANAL TREATMENT CONSENT FORM

I, __________________________, hereby consent to root canal treatment on tooth/teeth number: __________.

I understand that:
1. Root canal treatment involves removing infected or damaged pulp from inside the tooth.
2. The procedure may require multiple visits to complete.
3. Local anesthesia will be used to numb the area.
4. There is a risk that the treatment may not be successful and the tooth may still need to be extracted.
5. Possible complications include fracture of the tooth, instrument separation, and post-treatment discomfort.
6. A crown may be recommended after treatment to protect the tooth.
7. The cost of the treatment has been explained to me.

I authorize the dentist to perform the root canal procedure.

Patient Signature: _____________________ Date: _____________

Witness Signature: ____________________ Date: _____________`
  },
  {
    name: 'Tooth Extraction Consent',
    category: 'Treatment',
    content: `TOOTH EXTRACTION CONSENT FORM

I, __________________________, hereby consent to the extraction of tooth/teeth number: __________.

I understand that:
1. Tooth extraction involves the removal of a tooth from its socket in the bone.
2. Local anesthesia will be used to numb the area.
3. There may be bleeding, swelling, and discomfort after the procedure.
4. Possible complications include infection, dry socket, damage to adjacent teeth, and nerve injury.
5. I will follow post-operative instructions provided by the dentist.
6. Replacement options for the extracted tooth have been discussed with me.
7. The cost of the extraction has been explained to me.

I authorize the dentist to perform the tooth extraction.

Patient Signature: _____________________ Date: _____________

Witness Signature: ____________________ Date: _____________`
  },
  {
    name: 'Photography & Social Media Consent',
    category: 'Photography',
    content: `PHOTOGRAPHY & SOCIAL MEDIA CONSENT FORM

I, __________________________, hereby consent to the use of photographs, videos, or images taken during my dental treatment.

I understand that:
1. Photographs and videos may be taken for documentation, educational, or marketing purposes.
2. These images may be used on the clinic's website, social media platforms, brochures, or other promotional materials.
3. My identity will be protected as much as possible, and full names will not be disclosed without additional consent.
4. I can withdraw this consent at any time by providing written notice to the clinic.
5. Withdrawal of consent will not affect my dental treatment or relationship with the clinic.
6. The clinic will not sell or share my images with third parties for commercial purposes.

I authorize the clinic to use my photographs and images for the purposes stated above.

Patient Signature: _____________________ Date: _____________

Witness Signature: ____________________ Date: _____________`
  }
]

async function requireUser() {
  const t = getCurrentUser()
  if (!t) return null
  const db = await getDb()
  return loadUserContext(db, t.uid)
}

export async function POST(request) {
  try {
    const user = await requireUser()
    if (!user) return err('Unauthorized', 401)
    
    const { profile, db } = user
    const cid = profile.clinic_id
    
    if (!hasPermission(profile, 'consent_templates', 'create')) return err('Forbidden', 403)
    
    const now = new Date()
    const inserted = []
    
    for (const template of DEFAULT_TEMPLATES) {
      // Check if template already exists for this clinic
      const existing = await db.collection('consent_templates').findOne({
        clinic_id: cid,
        name: template.name
      })
      
      if (!existing) {
        const id = uuidv4()
        await db.collection('consent_templates').insertOne({
          id,
          clinic_id: cid,
          name: template.name,
          category: template.category,
          content: template.content,
          active: true,
          created_at: now,
          updated_at: now
        })
        inserted.push(template.name)
      }
    }
    
    return json({ 
      ok: true, 
      message: `Seeded ${inserted.length} default consent templates`,
      inserted 
    })
  } catch (error) {
    console.error('Seed consent templates error:', error)
    return err('Internal server error', 500)
  }
}

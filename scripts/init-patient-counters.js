/**
 * Initialize clinics.next_patient_seq from existing patient_code values.
 * Run: MONGO_URL=... node scripts/init-patient-counters.js
 */
import { getDb, closeDb } from '../lib/mongo.js'

if (!process.env.MONGO_URL) {
  console.error('MONGO_URL env var is required')
  process.exit(1)
}

async function maxPatientSeq(db, clinicId) {
  const last = await db.collection('patients')
    .find({ clinic_id: clinicId, patient_code: { $regex: /^PT\d+$/ } })
    .sort({ patient_code: -1 })
    .limit(1)
    .toArray()
  if (last.length === 0) return 0
  return parseInt(last[0].patient_code.replace('PT', ''), 10) || 0
}

async function main() {
  const db = await getDb()
  const clinics = await db.collection('clinics').find({}).toArray()
  let updated = 0
  let skipped = 0

  for (const clinic of clinics) {
    const maxSeq = await maxPatientSeq(db, clinic.id)
    const current = clinic.next_patient_seq
    if (current != null && current >= maxSeq) {
      skipped++
      continue
    }
    await db.collection('clinics').updateOne(
      { id: clinic.id },
      { $set: { next_patient_seq: maxSeq } }
    )
    updated++
    console.log(`${clinic.name || clinic.id}: next_patient_seq = ${maxSeq}`)
  }

  console.log(`Done. Updated: ${updated}, skipped (already set): ${skipped}`)
  await closeDb()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})

/**
 * Atomic patient_code generator — one shared counter per clinic_id.
 */
export async function nextPatientCode(db, clinicId) {
  const result = await db.collection('clinics').findOneAndUpdate(
    { id: clinicId },
    { $inc: { next_patient_seq: 1 } },
    { returnDocument: 'after' }
  )
  let seq = result?.next_patient_seq
  if (seq == null) {
    const last = await db.collection('patients')
      .find({ clinic_id: clinicId, patient_code: { $regex: /^PT\d+$/ } })
      .sort({ patient_code: -1 })
      .limit(1)
      .toArray()
    const lastNum = last.length > 0 ? parseInt(last[0].patient_code.replace('PT', ''), 10) : 0
    seq = lastNum + 1
    await db.collection('clinics').updateOne(
      { id: clinicId },
      { $set: { next_patient_seq: seq } }
    )
  }
  return 'PT' + String(seq).padStart(5, '0')
}

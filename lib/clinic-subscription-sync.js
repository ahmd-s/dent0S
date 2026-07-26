/** Unblock clinic access after successful subscription payment */
export async function activateClinicAccessOnPayment(db, clinicId) {
  await db.collection('clinics').updateOne(
    { id: clinicId },
    {
      $set: {
        subscription_status: 'active',
        trial_auto_enforcement: 'auto',
        updated_at: new Date(),
      },
    }
  )
}

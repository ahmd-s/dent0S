import { getDb } from './mongo.js'

export async function setupIndexes() {
  const db = await getDb()
  
  console.log('Setting up MongoDB indexes...')
  
  // PATIENTS collection indexes
  console.log('Creating indexes for patients collection...')
  await db.collection('patients').createIndex({ clinic_id: 1 })
  await db.collection('patients').createIndex({ clinic_id: 1, created_at: -1 })
  await db.collection('patients').createIndex({ clinic_id: 1, patient_code: 1 })
  await db.collection('patients').createIndex({ clinic_id: 1, phone: 1 })
  await db.collection('patients').createIndex({ clinic_id: 1, is_archived: 1 })
  await db.collection('patients').createIndex({ clinic_id: 1, last_visit_date: -1 })
  console.log('✓ Patients indexes created')
  
  // APPOINTMENTS collection indexes
  console.log('Creating indexes for appointments collection...')
  await db.collection('appointments').createIndex({ clinic_id: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, appointment_date: -1, appointment_time: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, patient_id: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, doctor_id: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, appointment_date: -1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, appointment_id: 1 })
  console.log('✓ Appointments indexes created')
  
  // VISITS collection indexes
  console.log('Creating indexes for visits collection...')
  await db.collection('visits').createIndex({ clinic_id: 1 })
  await db.collection('visits').createIndex({ clinic_id: 1, patient_id: 1 })
  await db.collection('visits').createIndex({ clinic_id: 1, doctor_id: 1 })
  await db.collection('visits').createIndex({ clinic_id: 1, appointment_id: 1 })
  await db.collection('visits').createIndex({ clinic_id: 1, visit_date: -1 })
  await db.collection('visits').createIndex({ clinic_id: 1, created_at: -1 })
  await db.collection('visits').createIndex({ clinic_id: 1, patient_id: 1, visit_date: -1, created_at: -1 })
  await db.collection('visits').createIndex({ clinic_id: 1, id: 1 })
  console.log('✓ Visits indexes created')
  
  // PRESCRIPTIONS collection indexes
  console.log('Creating indexes for prescriptions collection...')
  await db.collection('prescriptions').createIndex({ clinic_id: 1 })
  await db.collection('prescriptions').createIndex({ clinic_id: 1, visit_id: 1 })
  await db.collection('prescriptions').createIndex({ clinic_id: 1, id: 1 })
  console.log('✓ Prescriptions indexes created')
  
  // INVOICES collection indexes
  console.log('Creating indexes for invoices collection...')
  await db.collection('invoices').createIndex({ clinic_id: 1 })
  await db.collection('invoices').createIndex({ clinic_id: 1, visit_id: 1 })
  await db.collection('invoices').createIndex({ clinic_id: 1, patient_id: 1 })
  await db.collection('invoices').createIndex({ clinic_id: 1, invoice_date: -1 })
  await db.collection('invoices').createIndex({ clinic_id: 1, id: 1 })
  console.log('✓ Invoices indexes created')
  
  // INVOICE_ITEMS collection indexes
  console.log('Creating indexes for invoice_items collection...')
  await db.collection('invoice_items').createIndex({ clinic_id: 1 })
  await db.collection('invoice_items').createIndex({ clinic_id: 1, invoice_id: 1 })
  console.log('✓ Invoice items indexes created')
  
  // PROFILES collection indexes
  console.log('Creating indexes for profiles collection...')
  await db.collection('profiles').createIndex({ clinic_id: 1 })
  await db.collection('profiles').createIndex({ clinic_id: 1, id: 1 })
  await db.collection('profiles').createIndex({ clinic_id: 1, email: 1 })
  console.log('✓ Profiles indexes created')
  
  // CLINICS collection indexes
  console.log('Creating indexes for clinics collection...')
  await db.collection('clinics').createIndex({ slug: 1 })
  await db.collection('clinics').createIndex({ id: 1 })
  console.log('✓ Clinics indexes created')
  
  console.log('\n✅ All indexes created successfully!')
}

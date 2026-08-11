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
  // OPTIMIZATION: Added missing index for followup queries used in dashboard
  await db.collection('patients').createIndex({ clinic_id: 1, next_followup_date: 1 })
  await db.collection('patients').createIndex({ clinic_id: 1, is_archived: 1, next_followup_date: 1 })
  console.log('✓ Patients indexes created')
  
  // APPOINTMENTS collection indexes
  console.log('Creating indexes for appointments collection...')
  await db.collection('appointments').createIndex({ clinic_id: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, appointment_date: -1, appointment_time: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, patient_id: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, doctor_id: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, appointment_date: -1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, chair_id: 1, appointment_date: 1 })
  await db.collection('appointments').createIndex({ clinic_id: 1, status: 1, appointment_date: 1 })
  console.log('✓ Appointments indexes created')

  // CLINIC CHAIRS collection indexes
  console.log('Creating indexes for clinic_chairs collection...')
  await db.collection('clinic_chairs').createIndex({ clinic_id: 1 })
  await db.collection('clinic_chairs').createIndex({ clinic_id: 1, is_active: 1 })
  console.log('✓ Clinic chairs indexes created')

  // BLOCK TIMES collection indexes
  console.log('Creating indexes for block_times collection...')
  await db.collection('block_times').createIndex({ clinic_id: 1, doctor_id: 1, date: 1 })
  await db.collection('block_times').createIndex({ clinic_id: 1, date: 1, is_active: 1 })
  console.log('✓ Block times indexes created')
  
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
  // OPTIMIZATION: Added composite index for payment status + date queries
  await db.collection('invoices').createIndex({ clinic_id: 1, payment_status: 1, invoice_date: -1 })
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
  
  // LAB CASES collection indexes
  console.log('Creating indexes for lab_cases collection...')
  await db.collection('lab_cases').createIndex({ clinic_id: 1 })
  await db.collection('lab_cases').createIndex({ clinic_id: 1, patient_id: 1 })
  await db.collection('lab_cases').createIndex({ clinic_id: 1, vendor_id: 1 })
  await db.collection('lab_cases').createIndex({ clinic_id: 1, status: 1 })
  // OPTIMIZATION: Added composite index for overdue lab case queries
  await db.collection('lab_cases').createIndex({ clinic_id: 1, status: 1, expected_delivery_date: 1 })
  console.log('✓ Lab cases indexes created')
  
  // COUNTERS collection indexes (for optimized patient code generation)
  console.log('Creating indexes for counters collection...')
  await db.collection('counters').createIndex({ clinic_id: 1, type: 1 }, { unique: true })
  console.log('✓ Counters indexes created')
  
  console.log('\n✅ All indexes created successfully!')

  // PLATFORM ADMIN indexes
  console.log('Creating indexes for platform admin collections...')
  await db.collection('platform_admin_audit_logs').createIndex({ at: -1 })
  await db.collection('platform_admin_audit_logs').createIndex({ target_clinic_id: 1, at: -1 })
  await db.collection('clinic_manual_payments').createIndex({ clinic_id: 1, date: -1 })
  await db.collection('login_rate_limits').createIndex({ key: 1 }, { unique: true })
  await db.collection('profiles').createIndex({ is_platform_admin: 1 }, { sparse: true })
  await db.collection('visits').createIndex({ clinic_id: 1, visit_date: -1 })
  console.log('✓ Platform admin indexes created')

  // CLINIC WORKSPACES collection indexes
  console.log('Creating indexes for clinic_workspaces collection...')
  await db.collection('clinic_workspaces').createIndex({ clinic_id: 1 }, { unique: true })
  console.log('✓ Clinic workspaces indexes created')

  // ACTIVITY EVENTS collection indexes (Sprint 10)
  console.log('Creating indexes for activity_events collection...')
  await db.collection('activity_events').createIndex({ clinic_id: 1, created_at: -1 })
  await db.collection('activity_events').createIndex({ patient_id: 1, created_at: -1 })
  await db.collection('activity_events').createIndex({ visit_id: 1, created_at: -1 })
  await db.collection('activity_events').createIndex({ appointment_id: 1, created_at: -1 })
  await db.collection('activity_events').createIndex({ module: 1, created_at: -1 })
  await db.collection('activity_events').createIndex({ event: 1, created_at: -1 })
  await db.collection('activity_events').createIndex({ clinic_id: 1, module: 1, created_at: -1 })
  await db.collection('activity_events').createIndex({ clinic_id: 1, event: 1, created_at: -1 })
  console.log('✓ Activity events indexes created')
}

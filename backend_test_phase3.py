#!/usr/bin/env python3
"""
DentOS Backend API Test Suite - Phase 3
Tests multi-tenant SaaS clinic management system with JWT cookie auth
Includes Phase 1+2 regression + Phase 3: Doctors/Team/Templates, Invoices, Public Booking
"""

import requests
import json
import sys
from datetime import datetime, timedelta, date

# Base URL from .env
BASE_URL = "https://dental-os-3.preview.emergentagent.com/api"

# CRITICAL: Use date.today().isoformat() for "today" (env date is 2026-05-10)
def today_iso():
    return date.today().isoformat()

# Test data
CLINIC_A_DATA = {
    "full_name": "Dr. Rajesh Kumar",
    "email": f"rajesh.kumar.{datetime.now().timestamp()}@dentalclinic.in",
    "phone": "9876543210",
    "clinic_name": "Clinic Alpha Dental Care",
    "password": "password123"
}

CLINIC_B_DATA = {
    "full_name": "Dr. Priya Sharma",
    "email": f"priya.sharma.{datetime.now().timestamp()}@dentalcare.in",
    "phone": "9876543211",
    "clinic_name": "Clinic Beta Dental Solutions",
    "password": "password123"
}

def print_test(msg):
    print(f"\n{'='*80}")
    print(f"TEST: {msg}")
    print('='*80)

def print_pass(msg):
    print(f"✅ PASS: {msg}")

def print_fail(msg):
    print(f"❌ FAIL: {msg}")

def print_info(msg):
    print(f"ℹ️  INFO: {msg}")

class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def add_pass(self, test_name):
        self.passed += 1
        print_pass(test_name)
    
    def add_fail(self, test_name, error):
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
        print_fail(f"{test_name} - {error}")
    
    def summary(self):
        print(f"\n{'='*80}")
        print(f"TEST SUMMARY")
        print('='*80)
        print(f"Total Passed: {self.passed}")
        print(f"Total Failed: {self.failed}")
        if self.errors:
            print("\nFailed Tests:")
            for err in self.errors:
                print(f"  - {err}")
        print('='*80)
        return self.failed == 0

results = TestResults()

# ============================================================================
# PHASE 3 TEST 1: DOCTORS / TEAM / TREATMENT TEMPLATES
# ============================================================================

def test_phase3_doctors_team_templates(session_a, session_b):
    print_test("PHASE 3.1: DOCTORS / TEAM / TREATMENT TEMPLATES")
    
    # Test 1.1: GET /api/doctors (should be empty initially or only admin if role=doctor)
    print_info("1.1 Testing GET /api/doctors...")
    try:
        resp = session_a.get(f"{BASE_URL}/doctors")
        if resp.status_code == 200:
            data = resp.json()
            doctors = data.get('doctors', [])
            results.add_pass(f"GET /doctors successful (found {len(doctors)} doctors)")
        else:
            results.add_fail("GET /doctors", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /doctors", str(e))
    
    # Test 1.2: POST /api/team to add a doctor
    print_info("1.2 Testing POST /api/team to add a doctor...")
    doctor_id = None
    try:
        team_data = {
            "full_name": "Dr. Amit Verma",
            "email": f"amit.verma.{datetime.now().timestamp()}@clinicalpha.in",
            "role": "doctor",
            "password": "password123"
        }
        resp = session_a.post(f"{BASE_URL}/team", json=team_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                doctor_id = data['id']
                results.add_pass(f"POST /team created doctor (id: {doctor_id})")
            else:
                results.add_fail("POST /team", f"Missing ok or id: {data}")
        else:
            results.add_fail("POST /team", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /team", str(e))
    
    # Test 1.3: GET /api/doctors should now include the new doctor
    print_info("1.3 Testing GET /api/doctors includes new doctor...")
    try:
        resp = session_a.get(f"{BASE_URL}/doctors")
        if resp.status_code == 200:
            data = resp.json()
            doctors = data.get('doctors', [])
            if any(d.get('id') == doctor_id for d in doctors):
                results.add_pass("New doctor appears in GET /doctors")
            else:
                results.add_fail("GET /doctors after add", f"Doctor {doctor_id} not found in list")
        else:
            results.add_fail("GET /doctors after add", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /doctors after add", str(e))
    
    # Test 1.4: POST /api/team with duplicate email (should fail with 400)
    print_info("1.4 Testing POST /api/team with duplicate email...")
    try:
        resp = session_a.post(f"{BASE_URL}/team", json=team_data)
        if resp.status_code == 400:
            results.add_pass("Duplicate email correctly rejected with 400")
        else:
            results.add_fail("Duplicate team email", f"Expected 400, got {resp.status_code}")
    except Exception as e:
        results.add_fail("Duplicate team email", str(e))
    
    # Test 1.5: GET /api/team (should return all team members)
    print_info("1.5 Testing GET /api/team...")
    try:
        resp = session_a.get(f"{BASE_URL}/team")
        if resp.status_code == 200:
            data = resp.json()
            team = data.get('team', [])
            if len(team) >= 2:  # admin + doctor
                results.add_pass(f"GET /team returns {len(team)} members (admin + doctor)")
            else:
                results.add_fail("GET /team", f"Expected at least 2 members, got {len(team)}")
        else:
            results.add_fail("GET /team", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /team", str(e))
    
    # Test 1.6: PUT /api/team/:id to set is_active=false
    if doctor_id:
        print_info("1.6 Testing PUT /api/team/:id to set is_active=false...")
        try:
            resp = session_a.put(f"{BASE_URL}/team/{doctor_id}", json={"is_active": False})
            if resp.status_code == 200 and resp.json().get('ok'):
                results.add_pass("PUT /team/:id set is_active=false")
                
                # Verify doctor no longer appears in GET /doctors
                resp = session_a.get(f"{BASE_URL}/doctors")
                if resp.status_code == 200:
                    data = resp.json()
                    doctors = data.get('doctors', [])
                    if not any(d.get('id') == doctor_id for d in doctors):
                        results.add_pass("Inactive doctor not in GET /doctors")
                    else:
                        results.add_fail("GET /doctors after deactivate", "Inactive doctor still appears")
            else:
                results.add_fail("PUT /team/:id is_active", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("PUT /team/:id is_active", str(e))
        
        # Test 1.7: PUT /api/team/:id to change role to receptionist
        print_info("1.7 Testing PUT /api/team/:id to change role...")
        try:
            resp = session_a.put(f"{BASE_URL}/team/{doctor_id}", json={"role": "receptionist", "is_active": True})
            if resp.status_code == 200 and resp.json().get('ok'):
                results.add_pass("PUT /team/:id changed role to receptionist")
            else:
                results.add_fail("PUT /team/:id role", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("PUT /team/:id role", str(e))
    
    # Test 1.8: POST /api/treatment_templates
    print_info("1.8 Testing POST /api/treatment_templates...")
    template_id = None
    try:
        template_data = {
            "name": "Composite filling",
            "category": "Restorative",
            "default_notes": "Single surface composite",
            "default_price": 1500
        }
        resp = session_a.post(f"{BASE_URL}/treatment_templates", json=template_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                template_id = data['id']
                results.add_pass(f"POST /treatment_templates created (id: {template_id})")
            else:
                results.add_fail("POST /treatment_templates", f"Missing ok or id: {data}")
        else:
            results.add_fail("POST /treatment_templates", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /treatment_templates", str(e))
    
    # Test 1.9: GET /api/treatment_templates
    print_info("1.9 Testing GET /api/treatment_templates...")
    try:
        resp = session_a.get(f"{BASE_URL}/treatment_templates")
        if resp.status_code == 200:
            data = resp.json()
            templates = data.get('templates', [])
            if any(t.get('id') == template_id for t in templates):
                results.add_pass("GET /treatment_templates includes new template")
            else:
                results.add_fail("GET /treatment_templates", f"Template {template_id} not found")
        else:
            results.add_fail("GET /treatment_templates", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /treatment_templates", str(e))
    
    # Test 1.10: PUT /api/treatment_templates/:id to update price
    if template_id:
        print_info("1.10 Testing PUT /api/treatment_templates/:id...")
        try:
            resp = session_a.put(f"{BASE_URL}/treatment_templates/{template_id}", json={"default_price": 1800})
            if resp.status_code == 200 and resp.json().get('ok'):
                results.add_pass("PUT /treatment_templates/:id updated price")
            else:
                results.add_fail("PUT /treatment_templates/:id", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("PUT /treatment_templates/:id", str(e))
    
    # Test 1.11: DELETE /api/treatment_templates/:id
    if template_id:
        print_info("1.11 Testing DELETE /api/treatment_templates/:id...")
        try:
            resp = session_a.delete(f"{BASE_URL}/treatment_templates/{template_id}")
            if resp.status_code == 200 and resp.json().get('ok'):
                results.add_pass("DELETE /treatment_templates/:id successful")
                
                # Verify template is gone
                resp = session_a.get(f"{BASE_URL}/treatment_templates")
                if resp.status_code == 200:
                    data = resp.json()
                    templates = data.get('templates', [])
                    if not any(t.get('id') == template_id for t in templates):
                        results.add_pass("Deleted template not in GET /treatment_templates")
                    else:
                        results.add_fail("GET /treatment_templates after delete", "Deleted template still appears")
            else:
                results.add_fail("DELETE /treatment_templates/:id", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("DELETE /treatment_templates/:id", str(e))
    
    # Test 1.12: MULTI-TENANT - Clinic B should NOT see Clinic A's templates
    print_info("1.12 CRITICAL: Testing multi-tenant isolation for treatment templates...")
    try:
        resp = session_b.get(f"{BASE_URL}/treatment_templates")
        if resp.status_code == 200:
            data = resp.json()
            templates = data.get('templates', [])
            if len(templates) == 0:
                results.add_pass("CRITICAL: Clinic B cannot see Clinic A's templates (multi-tenant isolation)")
            else:
                results.add_fail("CRITICAL: Templates multi-tenant", f"Clinic B sees {len(templates)} templates - SECURITY BREACH!")
        else:
            results.add_fail("GET /treatment_templates Clinic B", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /treatment_templates Clinic B", str(e))

# ============================================================================
# PHASE 3 TEST 2: VISITS WITH INVOICE CREATION
# ============================================================================

def test_phase3_visits_with_invoice(session_a, session_b):
    print_test("PHASE 3.2: VISITS WITH INVOICE CREATION")
    
    today = today_iso()
    print_info(f"Using today's date: {today}")
    
    # Create patient and appointment for Clinic A
    print_info("2.1 Creating patient for invoice test...")
    patient_id = None
    try:
        patient_data = {
            "name": "Suresh Patel",
            "phone": "9988776655",
            "age": 38,
            "gender": "male"
        }
        resp = session_a.post(f"{BASE_URL}/patients", json=patient_data)
        if resp.status_code == 200:
            data = resp.json()
            patient_id = data.get('id')
            results.add_pass(f"Patient created for invoice test (id: {patient_id})")
        else:
            results.add_fail("Create patient for invoice", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Create patient for invoice", str(e))
    
    if not patient_id:
        print_fail("Cannot continue invoice tests without patient_id")
        return
    
    # Create appointment for today
    print_info("2.2 Creating appointment for today...")
    appointment_id = None
    try:
        appt_data = {
            "patient_id": patient_id,
            "appointment_date": today,
            "appointment_time": "02:00 PM",
            "appointment_type": "consultation",
            "chief_complaint": "Toothache"
        }
        resp = session_a.post(f"{BASE_URL}/appointments", json=appt_data)
        if resp.status_code == 200:
            data = resp.json()
            appointment_id = data.get('id')
            results.add_pass(f"Appointment created (id: {appointment_id})")
        else:
            results.add_fail("Create appointment for invoice", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Create appointment for invoice", str(e))
    
    if not appointment_id:
        print_fail("Cannot continue invoice tests without appointment_id")
        return
    
    # Test 2.3: POST /api/visits to create visit
    print_info("2.3 Creating visit V1...")
    visit_id = None
    try:
        visit_data = {
            "appointment_id": appointment_id,
            "patient_id": patient_id,
            "chief_complaint": "Toothache"
        }
        resp = session_a.post(f"{BASE_URL}/visits", json=visit_data)
        if resp.status_code == 200:
            data = resp.json()
            visit_id = data.get('id')
            results.add_pass(f"Visit V1 created (id: {visit_id})")
            
            # Verify appointment status changed to in_progress
            resp = session_a.get(f"{BASE_URL}/appointments?date={today}")
            if resp.status_code == 200:
                data = resp.json()
                appts = data.get('appointments', [])
                appt = next((a for a in appts if a.get('id') == appointment_id), None)
                if appt and appt.get('status') == 'in_progress':
                    results.add_pass("Appointment status changed to 'in_progress'")
                else:
                    results.add_fail("Appointment status check", f"Expected 'in_progress', got '{appt.get('status') if appt else 'not found'}'")
        else:
            results.add_fail("Create visit V1", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Create visit V1", str(e))
    
    if not visit_id:
        print_fail("Cannot continue invoice tests without visit_id")
        return
    
    # Test 2.4: PUT /api/visits/:id with invoice_items, discount, gst, complete=true
    print_info("2.4 Testing PUT /api/visits/:id with invoice creation...")
    invoice_id = None
    try:
        update_data = {
            "chief_complaint": "Toothache, lower right",
            "diagnosis": "Deep caries 46",
            "treatment_done": "Composite filling done",
            "prescriptions": [
                {
                    "medicine_name": "Amoxicillin",
                    "dosage": "500mg",
                    "frequency": "TID",
                    "duration": "5 days"
                }
            ],
            "invoice_items": [
                {"description": "Composite filling", "quantity": 1, "unit_price": 1500},
                {"description": "Consultation", "quantity": 1, "unit_price": 300},
                {"description": "", "quantity": 1, "unit_price": 99}  # empty desc - should be filtered
            ],
            "discount": 200,
            "gst_enabled": True,
            "payment_mode": "upi",
            "payment_status": "paid",
            "complete": True
        }
        resp = session_a.put(f"{BASE_URL}/visits/{visit_id}", json=update_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok'):
                invoice_id = data.get('invoice_id')
                results.add_pass(f"PUT /visits/:id with invoice successful (invoice_id: {invoice_id})")
            else:
                results.add_fail("PUT /visits/:id with invoice", f"Response ok=false: {data}")
        else:
            results.add_fail("PUT /visits/:id with invoice", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("PUT /visits/:id with invoice", str(e))
    
    # Test 2.5: GET /api/visits/:id to verify invoice details
    print_info("2.5 Verifying invoice details in visit...")
    try:
        resp = session_a.get(f"{BASE_URL}/visits/{visit_id}")
        if resp.status_code == 200:
            data = resp.json()
            visit = data.get('visit', {})
            invoice = visit.get('invoice')
            
            if invoice:
                results.add_pass("Visit has invoice attached")
                
                # Check items (empty description should be filtered)
                items = invoice.get('items', [])
                if len(items) == 2:
                    results.add_pass("Invoice items filtered correctly (2 valid, 1 empty removed)")
                else:
                    results.add_fail("Invoice items filtering", f"Expected 2 items, got {len(items)}")
                
                # Check calculations: subtotal = 1500 + 300 = 1800
                subtotal = invoice.get('subtotal')
                if subtotal == 1800:
                    results.add_pass(f"Invoice subtotal correct: {subtotal}")
                else:
                    results.add_fail("Invoice subtotal", f"Expected 1800, got {subtotal}")
                
                # Check discount
                discount = invoice.get('discount')
                if discount == 200:
                    results.add_pass(f"Invoice discount correct: {discount}")
                else:
                    results.add_fail("Invoice discount", f"Expected 200, got {discount}")
                
                # Check GST: (1800 - 200) * 0.18 = 288
                gst_amount = invoice.get('gst_amount')
                expected_gst = round((1800 - 200) * 0.18 * 100) / 100
                if gst_amount == expected_gst:
                    results.add_pass(f"Invoice GST correct: {gst_amount}")
                else:
                    results.add_fail("Invoice GST", f"Expected {expected_gst}, got {gst_amount}")
                
                # Check total: 1800 - 200 + 288 = 1888
                total_amount = invoice.get('total_amount')
                expected_total = 1800 - 200 + expected_gst
                if total_amount == expected_total:
                    results.add_pass(f"Invoice total correct: {total_amount}")
                else:
                    results.add_fail("Invoice total", f"Expected {expected_total}, got {total_amount}")
                
                # Check invoice_number format: INV-XXX-#####
                invoice_number = invoice.get('invoice_number', '')
                import re
                if re.match(r'^INV-[A-Z]{1,3}-\d{5}$', invoice_number):
                    results.add_pass(f"Invoice number format correct: {invoice_number}")
                else:
                    results.add_fail("Invoice number format", f"Expected INV-XXX-##### format, got: {invoice_number}")
            else:
                results.add_fail("Visit invoice", "Invoice not found in visit")
        else:
            results.add_fail("GET /visits/:id for invoice check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /visits/:id for invoice check", str(e))
    
    # Test 2.6: Verify appointment status is completed
    print_info("2.6 Verifying appointment status is completed...")
    try:
        resp = session_a.get(f"{BASE_URL}/appointments?date={today}")
        if resp.status_code == 200:
            data = resp.json()
            appts = data.get('appointments', [])
            appt = next((a for a in appts if a.get('id') == appointment_id), None)
            if appt and appt.get('status') == 'completed':
                results.add_pass("Appointment status is 'completed' after visit completion")
            else:
                results.add_fail("Appointment completion", f"Expected 'completed', got '{appt.get('status') if appt else 'not found'}'")
        else:
            results.add_fail("GET appointments for completion check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Appointment completion check", str(e))
    
    # Test 2.7: Verify patient.total_visits incremented
    print_info("2.7 Verifying patient.total_visits incremented...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients/{patient_id}")
        if resp.status_code == 200:
            data = resp.json()
            patient = data.get('patient', {})
            if patient.get('total_visits') == 1:
                results.add_pass("Patient total_visits incremented to 1")
            else:
                results.add_fail("Patient total_visits", f"Expected 1, got {patient.get('total_visits')}")
        else:
            results.add_fail("GET patient for total_visits check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Patient total_visits check", str(e))
    
    # Test 2.8: PUT /api/visits/:id again with different items (should REPLACE)
    print_info("2.8 Testing PUT /api/visits/:id again to replace items...")
    try:
        update_data = {
            "invoice_items": [
                {"description": "X-ray", "quantity": 1, "unit_price": 500}
            ],
            "discount": 0,
            "gst_enabled": False,
            "payment_mode": "cash",
            "payment_status": "paid"
        }
        resp = session_a.put(f"{BASE_URL}/visits/{visit_id}", json=update_data)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("PUT /visits/:id replaced invoice items")
            
            # Verify items replaced
            resp = session_a.get(f"{BASE_URL}/visits/{visit_id}")
            if resp.status_code == 200:
                data = resp.json()
                visit = data.get('visit', {})
                invoice = visit.get('invoice')
                if invoice:
                    items = invoice.get('items', [])
                    if len(items) == 1 and items[0].get('description') == 'X-ray':
                        results.add_pass("Invoice items replaced correctly (1 item: X-ray)")
                    else:
                        results.add_fail("Invoice items replacement", f"Expected 1 X-ray item, got {len(items)} items")
        else:
            results.add_fail("PUT /visits/:id replace items", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("PUT /visits/:id replace items", str(e))
    
    return invoice_id

# ============================================================================
# PHASE 3 TEST 3: INVOICES CRUD WITH SUMMARY
# ============================================================================

def test_phase3_invoices_crud(session_a, session_b, invoice_id):
    print_test("PHASE 3.3: INVOICES CRUD WITH SUMMARY")
    
    today = today_iso()
    
    # Test 3.1: GET /api/invoices (list with summary)
    print_info("3.1 Testing GET /api/invoices...")
    try:
        resp = session_a.get(f"{BASE_URL}/invoices")
        if resp.status_code == 200:
            data = resp.json()
            invoices = data.get('invoices', [])
            summary = data.get('summary', {})
            
            if isinstance(invoices, list):
                results.add_pass(f"GET /invoices returns array ({len(invoices)} invoices)")
                
                # Check if our invoice is in the list
                if any(i.get('id') == invoice_id for i in invoices):
                    results.add_pass("Invoice from visit test found in list")
                    
                    # Check patient_name is joined
                    inv = next((i for i in invoices if i.get('id') == invoice_id), None)
                    if inv and 'patient_name' in inv:
                        results.add_pass(f"Invoice has patient_name: {inv['patient_name']}")
                    else:
                        results.add_fail("Invoice patient_name", "patient_name not joined")
            else:
                results.add_fail("GET /invoices", f"Expected array, got {type(invoices)}")
            
            # Check summary
            if isinstance(summary, dict):
                if 'collected' in summary and 'pending' in summary and 'total' in summary:
                    results.add_pass(f"Summary has collected/pending/total: {summary}")
                else:
                    results.add_fail("Invoice summary", f"Missing fields in summary: {summary.keys()}")
            else:
                results.add_fail("Invoice summary", f"Expected dict, got {type(summary)}")
        else:
            results.add_fail("GET /invoices", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /invoices", str(e))
    
    # Test 3.2: GET /api/invoices?status=paid
    print_info("3.2 Testing GET /api/invoices?status=paid...")
    try:
        resp = session_a.get(f"{BASE_URL}/invoices?status=paid")
        if resp.status_code == 200:
            data = resp.json()
            invoices = data.get('invoices', [])
            # All should be paid
            if all(i.get('payment_status') == 'paid' for i in invoices):
                results.add_pass(f"GET /invoices?status=paid filters correctly ({len(invoices)} paid)")
            else:
                results.add_fail("GET /invoices?status=paid", "Some invoices are not paid")
        else:
            results.add_fail("GET /invoices?status=paid", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /invoices?status=paid", str(e))
    
    # Test 3.3: GET /api/invoices?from=today&to=today
    print_info("3.3 Testing GET /api/invoices with date range...")
    try:
        resp = session_a.get(f"{BASE_URL}/invoices?from={today}&to={today}")
        if resp.status_code == 200:
            data = resp.json()
            invoices = data.get('invoices', [])
            if any(i.get('id') == invoice_id for i in invoices):
                results.add_pass("GET /invoices with date range includes today's invoice")
            else:
                results.add_fail("GET /invoices date range", "Today's invoice not found in date range")
        else:
            results.add_fail("GET /invoices date range", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /invoices date range", str(e))
    
    # Test 3.4: GET /api/invoices?q=<patient name>
    print_info("3.4 Testing GET /api/invoices with search query...")
    try:
        resp = session_a.get(f"{BASE_URL}/invoices?q=Suresh")
        if resp.status_code == 200:
            data = resp.json()
            invoices = data.get('invoices', [])
            if len(invoices) > 0:
                results.add_pass(f"GET /invoices?q=Suresh returns results ({len(invoices)})")
            else:
                results.add_fail("GET /invoices search", "No results for patient name search")
        else:
            results.add_fail("GET /invoices search", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /invoices search", str(e))
    
    # Test 3.5: GET /api/invoices/:id (detail)
    if invoice_id:
        print_info("3.5 Testing GET /api/invoices/:id...")
        try:
            resp = session_a.get(f"{BASE_URL}/invoices/{invoice_id}")
            if resp.status_code == 200:
                data = resp.json()
                invoice = data.get('invoice', {})
                
                if invoice.get('id') == invoice_id:
                    results.add_pass("GET /invoices/:id returns correct invoice")
                    
                    # Check for joined data
                    required_fields = ['items', 'patient', 'visit', 'doctor_name', 'clinic']
                    missing = [f for f in required_fields if f not in invoice]
                    if not missing:
                        results.add_pass("Invoice detail has all joined fields (items, patient, visit, doctor_name, clinic)")
                    else:
                        results.add_fail("Invoice detail fields", f"Missing fields: {missing}")
                else:
                    results.add_fail("GET /invoices/:id", f"Expected invoice {invoice_id}, got {invoice.get('id')}")
            else:
                results.add_fail("GET /invoices/:id", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("GET /invoices/:id", str(e))
    
    # Test 3.6: PUT /api/invoices/:id to update payment_status
    if invoice_id:
        print_info("3.6 Testing PUT /api/invoices/:id to update payment_status...")
        try:
            resp = session_a.put(f"{BASE_URL}/invoices/{invoice_id}", json={"payment_status": "pending"})
            if resp.status_code == 200 and resp.json().get('ok'):
                results.add_pass("PUT /invoices/:id updated payment_status")
                
                # Verify update
                resp = session_a.get(f"{BASE_URL}/invoices/{invoice_id}")
                if resp.status_code == 200:
                    data = resp.json()
                    invoice = data.get('invoice', {})
                    if invoice.get('payment_status') == 'pending':
                        results.add_pass("Invoice payment_status updated to 'pending'")
                    else:
                        results.add_fail("Invoice payment_status update", f"Expected 'pending', got '{invoice.get('payment_status')}'")
            else:
                results.add_fail("PUT /invoices/:id", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("PUT /invoices/:id", str(e))
    
    # Test 3.7: MULTI-TENANT - Clinic B should NOT see Clinic A's invoices
    print_info("3.7 CRITICAL: Testing multi-tenant isolation for invoices...")
    try:
        resp = session_b.get(f"{BASE_URL}/invoices")
        if resp.status_code == 200:
            data = resp.json()
            invoices = data.get('invoices', [])
            if len(invoices) == 0:
                results.add_pass("CRITICAL: Clinic B cannot see Clinic A's invoices (multi-tenant isolation)")
            else:
                results.add_fail("CRITICAL: Invoices multi-tenant", f"Clinic B sees {len(invoices)} invoices - SECURITY BREACH!")
        else:
            results.add_fail("GET /invoices Clinic B", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /invoices Clinic B", str(e))
    
    # Test 3.8: MULTI-TENANT - Clinic B should get 404 for Clinic A's invoice
    if invoice_id:
        print_info("3.8 CRITICAL: Testing Clinic B GET /invoices/:id (should return 404)...")
        try:
            resp = session_b.get(f"{BASE_URL}/invoices/{invoice_id}")
            if resp.status_code == 404:
                results.add_pass("CRITICAL: Clinic B gets 404 for Clinic A's invoice (multi-tenant isolation)")
            else:
                results.add_fail("CRITICAL: Invoice multi-tenant", f"Expected 404, got {resp.status_code} - SECURITY BREACH!")
        except Exception as e:
            results.add_fail("GET /invoices/:id Clinic B", str(e))

# ============================================================================
# PHASE 3 TEST 4: CLINIC UPDATE + SLUG CHANGE
# ============================================================================

def test_phase3_clinic_update_slug(session_a, session_b):
    print_test("PHASE 3.4: CLINIC UPDATE + SLUG CHANGE")
    
    # Test 4.1: PUT /api/clinic to update name and phone
    print_info("4.1 Testing PUT /api/clinic to update name and phone...")
    try:
        update_data = {
            "name": "Clinic Alpha Updated",
            "phone": "9000099999"
        }
        resp = session_a.put(f"{BASE_URL}/clinic", json=update_data)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("PUT /clinic updated name and phone")
            
            # Verify via GET /auth/me
            resp = session_a.get(f"{BASE_URL}/auth/me")
            if resp.status_code == 200:
                data = resp.json()
                clinic = data.get('clinic', {})
                if clinic.get('name') == "Clinic Alpha Updated" and clinic.get('phone') == "9000099999":
                    results.add_pass("Clinic name and phone updated correctly")
                else:
                    results.add_fail("Clinic update verification", f"Name: {clinic.get('name')}, Phone: {clinic.get('phone')}")
        else:
            results.add_fail("PUT /clinic", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("PUT /clinic", str(e))
    
    # Test 4.2: PUT /api/clinic to update slug
    print_info("4.2 Testing PUT /api/clinic to update slug...")
    new_slug = None
    try:
        update_data = {
            "slug": "alpha-updated-1234"
        }
        resp = session_a.put(f"{BASE_URL}/clinic", json=update_data)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("PUT /clinic updated slug")
            
            # Verify via GET /auth/me
            resp = session_a.get(f"{BASE_URL}/auth/me")
            if resp.status_code == 200:
                data = resp.json()
                clinic = data.get('clinic', {})
                new_slug = clinic.get('slug')
                if new_slug == "alpha-updated-1234":
                    results.add_pass(f"Clinic slug updated to: {new_slug}")
                else:
                    results.add_fail("Clinic slug update", f"Expected 'alpha-updated-1234', got '{new_slug}'")
        else:
            results.add_fail("PUT /clinic slug", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("PUT /clinic slug", str(e))
    
    # Test 4.3: Get Clinic B's slug
    print_info("4.3 Getting Clinic B's slug...")
    clinic_b_slug = None
    try:
        resp = session_b.get(f"{BASE_URL}/auth/me")
        if resp.status_code == 200:
            data = resp.json()
            clinic = data.get('clinic', {})
            clinic_b_slug = clinic.get('slug')
            results.add_pass(f"Clinic B slug: {clinic_b_slug}")
        else:
            results.add_fail("GET Clinic B slug", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET Clinic B slug", str(e))
    
    # Test 4.4: Try to set Clinic A's slug to Clinic B's slug (should fail with 400)
    if clinic_b_slug:
        print_info("4.4 Testing slug uniqueness (should fail with 400)...")
        try:
            update_data = {
                "slug": clinic_b_slug
            }
            resp = session_a.put(f"{BASE_URL}/clinic", json=update_data)
            if resp.status_code == 400:
                results.add_pass("Duplicate slug correctly rejected with 400 ('Slug already in use')")
            else:
                results.add_fail("Duplicate slug", f"Expected 400, got {resp.status_code}")
        except Exception as e:
            results.add_fail("Duplicate slug", str(e))

# ============================================================================
# PHASE 3 TEST 5: PUBLIC BOOKING (NO AUTH)
# ============================================================================

def test_phase3_public_booking(session_a):
    print_test("PHASE 3.5: PUBLIC BOOKING (NO AUTH)")
    
    # First, set up working hours for Clinic A
    print_info("5.1 Setting up working hours for Clinic A...")
    clinic_slug = None
    try:
        # Get current clinic slug
        resp = session_a.get(f"{BASE_URL}/auth/me")
        if resp.status_code == 200:
            data = resp.json()
            clinic = data.get('clinic', {})
            clinic_slug = clinic.get('slug')
            results.add_pass(f"Clinic A slug: {clinic_slug}")
        
        # Set working hours
        working_hours = [
            {"day": "Mon", "open": True, "start": "10:00 AM", "end": "06:00 PM"},
            {"day": "Tue", "open": True, "start": "10:00 AM", "end": "06:00 PM"},
            {"day": "Wed", "open": True, "start": "10:00 AM", "end": "06:00 PM"},
            {"day": "Thu", "open": True, "start": "10:00 AM", "end": "06:00 PM"},
            {"day": "Fri", "open": True, "start": "10:00 AM", "end": "06:00 PM"},
            {"day": "Sat", "open": True, "start": "10:00 AM", "end": "06:00 PM"},
            {"day": "Sun", "open": False, "start": "10:00 AM", "end": "06:00 PM"}
        ]
        resp = session_a.put(f"{BASE_URL}/clinic", json={"working_hours": working_hours})
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("Working hours set for Clinic A")
        else:
            results.add_fail("Set working hours", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Set working hours", str(e))
    
    if not clinic_slug:
        print_fail("Cannot continue public booking tests without clinic_slug")
        return
    
    # Create a fresh unauthenticated session for public endpoints
    public_session = requests.Session()
    
    # Test 5.2: GET /api/public/clinic/:slug
    print_info("5.2 Testing GET /api/public/clinic/:slug (unauthenticated)...")
    try:
        resp = public_session.get(f"{BASE_URL}/public/clinic/{clinic_slug}")
        if resp.status_code == 200:
            data = resp.json()
            if 'clinic' in data and 'doctors' in data:
                results.add_pass(f"GET /public/clinic/:slug returns clinic + doctors (unauthenticated)")
            else:
                results.add_fail("GET /public/clinic/:slug", f"Missing clinic or doctors: {data.keys()}")
        else:
            results.add_fail("GET /public/clinic/:slug", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /public/clinic/:slug", str(e))
    
    # Test 5.3: GET /api/public/clinic/nonexistent (should return 404)
    print_info("5.3 Testing GET /api/public/clinic/nonexistent (should return 404)...")
    try:
        resp = public_session.get(f"{BASE_URL}/public/clinic/nonexistent-slug-12345")
        if resp.status_code == 404:
            results.add_pass("GET /public/clinic/nonexistent returns 404")
        else:
            results.add_fail("GET /public/clinic/nonexistent", f"Expected 404, got {resp.status_code}")
    except Exception as e:
        results.add_fail("GET /public/clinic/nonexistent", str(e))
    
    # Test 5.4: GET /api/public/clinic/:slug/slots?date=<Monday>
    print_info("5.4 Testing GET /api/public/clinic/:slug/slots for Monday (open day)...")
    try:
        # Use 2026-05-11 which is a Monday
        resp = public_session.get(f"{BASE_URL}/public/clinic/{clinic_slug}/slots?date=2026-05-11")
        if resp.status_code == 200:
            data = resp.json()
            slots = data.get('slots', [])
            if len(slots) > 0:
                results.add_pass(f"GET /public/clinic/:slug/slots returns {len(slots)} slots for Monday")
                # Check slot format
                if all('time' in s and 'taken' in s for s in slots):
                    results.add_pass("Slots have correct format (time, taken)")
                    # Check time range (10:00 AM to 05:30 PM, last slot before 06:00 PM)
                    first_slot = slots[0].get('time')
                    last_slot = slots[-1].get('time')
                    if first_slot == "10:00 AM" and last_slot == "05:30 PM":
                        results.add_pass(f"Slot times correct: {first_slot} to {last_slot}")
                    else:
                        results.add_fail("Slot times", f"Expected 10:00 AM to 05:30 PM, got {first_slot} to {last_slot}")
                else:
                    results.add_fail("Slot format", "Slots missing time or taken fields")
            else:
                results.add_fail("GET /public/clinic/:slug/slots", "No slots returned for open day")
        else:
            results.add_fail("GET /public/clinic/:slug/slots", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /public/clinic/:slug/slots", str(e))
    
    # Test 5.5: GET /api/public/clinic/:slug/slots?date=<Sunday> (closed day)
    print_info("5.5 Testing GET /api/public/clinic/:slug/slots for Sunday (closed day)...")
    try:
        # Use 2026-05-10 which is a Sunday
        resp = public_session.get(f"{BASE_URL}/public/clinic/{clinic_slug}/slots?date=2026-05-10")
        if resp.status_code == 200:
            data = resp.json()
            slots = data.get('slots', [])
            if len(slots) == 0:
                results.add_pass("GET /public/clinic/:slug/slots returns empty array for Sunday (closed)")
            else:
                results.add_fail("GET /public/clinic/:slug/slots Sunday", f"Expected empty array, got {len(slots)} slots")
        else:
            results.add_fail("GET /public/clinic/:slug/slots Sunday", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /public/clinic/:slug/slots Sunday", str(e))
    
    # Test 5.6: POST /api/public/clinic/:slug/book (first booking)
    print_info("5.6 Testing POST /api/public/clinic/:slug/book (first booking)...")
    booking_id_1 = None
    try:
        booking_data = {
            "name": "Walk-in Patient 1",
            "phone": "9111122223",
            "appointment_date": "2026-05-11",
            "appointment_time": "10:00 AM",
            "reason": "Cleaning"
        }
        resp = public_session.post(f"{BASE_URL}/public/clinic/{clinic_slug}/book", json=booking_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                booking_id_1 = data['id']
                results.add_pass(f"POST /public/clinic/:slug/book successful (id: {booking_id_1})")
            else:
                results.add_fail("POST /public/clinic/:slug/book", f"Missing ok or id: {data}")
        else:
            results.add_fail("POST /public/clinic/:slug/book", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /public/clinic/:slug/book", str(e))
    
    # Test 5.7: Book 2 more times with same phone (should succeed - limit is 3)
    print_info("5.7 Testing 2 more bookings with same phone (should succeed)...")
    try:
        for i in range(2, 4):
            booking_data = {
                "name": f"Walk-in Patient {i}",
                "phone": "9111122223",
                "appointment_date": "2026-05-11",
                "appointment_time": f"10:{i*15:02d} AM",
                "reason": "Checkup"
            }
            resp = public_session.post(f"{BASE_URL}/public/clinic/{clinic_slug}/book", json=booking_data)
            if resp.status_code == 200:
                results.add_pass(f"Booking {i} with same phone successful")
            else:
                results.add_fail(f"Booking {i} with same phone", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Multiple bookings same phone", str(e))
    
    # Test 5.8: 4th booking with same phone (should fail with 429)
    print_info("5.8 Testing 4th booking with same phone (should fail with 429)...")
    try:
        booking_data = {
            "name": "Walk-in Patient 4",
            "phone": "9111122223",
            "appointment_date": "2026-05-11",
            "appointment_time": "11:00 AM",
            "reason": "Emergency"
        }
        resp = public_session.post(f"{BASE_URL}/public/clinic/{clinic_slug}/book", json=booking_data)
        if resp.status_code == 429:
            results.add_pass("4th booking correctly rejected with 429 ('Too many bookings')")
        else:
            results.add_fail("4th booking rate limit", f"Expected 429, got {resp.status_code}")
    except Exception as e:
        results.add_fail("4th booking rate limit", str(e))
    
    # Test 5.9: Book same time with different phone (should fail with 409)
    print_info("5.9 Testing booking same time with different phone (should fail with 409)...")
    try:
        booking_data = {
            "name": "Another Patient",
            "phone": "9222233334",
            "appointment_date": "2026-05-11",
            "appointment_time": "10:00 AM",
            "reason": "Consultation"
        }
        resp = public_session.post(f"{BASE_URL}/public/clinic/{clinic_slug}/book", json=booking_data)
        if resp.status_code == 409:
            results.add_pass("Duplicate time slot correctly rejected with 409 ('Slot already booked')")
        else:
            results.add_fail("Duplicate time slot", f"Expected 409, got {resp.status_code}")
    except Exception as e:
        results.add_fail("Duplicate time slot", str(e))
    
    # Test 5.10: Book with invalid phone (should fail with 400)
    print_info("5.10 Testing booking with invalid phone (should fail with 400)...")
    try:
        booking_data = {
            "name": "Invalid Phone Patient",
            "phone": "12345",
            "appointment_date": "2026-05-11",
            "appointment_time": "11:30 AM",
            "reason": "Checkup"
        }
        resp = public_session.post(f"{BASE_URL}/public/clinic/{clinic_slug}/book", json=booking_data)
        if resp.status_code == 400:
            results.add_pass("Invalid phone correctly rejected with 400")
        else:
            results.add_fail("Invalid phone validation", f"Expected 400, got {resp.status_code}")
    except Exception as e:
        results.add_fail("Invalid phone validation", str(e))
    
    # Test 5.11: Verify public bookings visible in authenticated GET /api/appointments
    print_info("5.11 Testing public bookings visible in authenticated GET /api/appointments...")
    try:
        resp = session_a.get(f"{BASE_URL}/appointments?date=2026-05-11")
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get('appointments', [])
            # Find bookings with booked_via='online'
            online_bookings = [a for a in appointments if a.get('booked_via') == 'online']
            if len(online_bookings) >= 3:
                results.add_pass(f"Public bookings visible in authenticated GET /appointments ({len(online_bookings)} online bookings)")
                # Check patient_name from patient_name_temp
                if any('Walk-in Patient' in a.get('patient_name', '') for a in online_bookings):
                    results.add_pass("Public booking patient_name from patient_name_temp")
                else:
                    results.add_fail("Public booking patient_name", "patient_name not from patient_name_temp")
            else:
                results.add_fail("Public bookings visibility", f"Expected at least 3 online bookings, got {len(online_bookings)}")
        else:
            results.add_fail("GET /appointments for public bookings", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Public bookings visibility", str(e))

# ============================================================================
# MAIN TEST EXECUTION
# ============================================================================

def main():
    print("\n" + "="*80)
    print("DentOS Backend API Test Suite - Phase 3")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print(f"Today's date (env): {today_iso()}")
    print("="*80)
    
    try:
        # Sign up two fresh clinics
        print_info("Setting up test environment: Creating Clinic A and Clinic B...")
        session_a = requests.Session()
        session_b = requests.Session()
        
        # Signup Clinic A
        resp = session_a.post(f"{BASE_URL}/auth/signup", json=CLINIC_A_DATA)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("Clinic A signup successful")
        else:
            results.add_fail("Clinic A signup", f"Status {resp.status_code}: {resp.text}")
        
        # Signup Clinic B
        resp = session_b.post(f"{BASE_URL}/auth/signup", json=CLINIC_B_DATA)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("Clinic B signup successful")
        else:
            results.add_fail("Clinic B signup", f"Status {resp.status_code}: {resp.text}")
        
        # Complete onboarding for Clinic A (required for some tests)
        resp = session_a.post(f"{BASE_URL}/onboarding/complete")
        if resp.status_code == 200:
            results.add_pass("Clinic A onboarding completed")
        
        # PHASE 3 TESTS
        print_info("\n\nStarting Phase 3 tests...")
        
        # Test 1: Doctors / Team / Treatment Templates
        test_phase3_doctors_team_templates(session_a, session_b)
        
        # Test 2: Visits with Invoice Creation
        invoice_id = test_phase3_visits_with_invoice(session_a, session_b)
        
        # Test 3: Invoices CRUD with Summary
        if invoice_id:
            test_phase3_invoices_crud(session_a, session_b, invoice_id)
        else:
            print_fail("Skipping invoices CRUD tests - no invoice_id from previous test")
        
        # Test 4: Clinic Update + Slug Change
        test_phase3_clinic_update_slug(session_a, session_b)
        
        # Test 5: Public Booking (NO AUTH)
        test_phase3_public_booking(session_a)
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Print summary
    success = results.summary()
    
    if success:
        print("\n✅ ALL TESTS PASSED!")
        return True
    else:
        print(f"\n❌ {results.failed} TEST(S) FAILED")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)

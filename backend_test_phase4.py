#!/usr/bin/env python3
"""
DentOS Backend API Test Suite - Phase 4
Tests AI Patient Summary endpoint (POST /api/generate-summary)
Uses Anthropic Claude via Emergent gateway
"""

import requests
import json
import sys
from datetime import datetime, date

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
    "password": "SecurePass123!"
}

CLINIC_B_DATA = {
    "full_name": "Dr. Priya Sharma",
    "email": f"priya.sharma.{datetime.now().timestamp()}@dentalcare.in",
    "phone": "9876543211",
    "clinic_name": "Clinic Beta Dental Solutions",
    "password": "SecurePass456!"
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
# PHASE 4 TEST: AI PATIENT SUMMARY
# ============================================================================

def test_phase4_ai_patient_summary():
    print_test("PHASE 4: AI PATIENT SUMMARY (POST /api/generate-summary)")
    
    # Step 1: Sign up Clinic A (admin) and complete onboarding
    print_info("Step 1: Sign up Clinic A and complete onboarding...")
    session_a = requests.Session()
    
    try:
        # 1.1 Signup
        resp = session_a.post(f"{BASE_URL}/auth/signup", json=CLINIC_A_DATA)
        if resp.status_code != 200:
            results.add_fail("Clinic A signup", f"Status {resp.status_code}: {resp.text}")
            return
        results.add_pass("Clinic A signup successful")
        
        # 1.2 Complete onboarding - clinic info
        resp = session_a.post(f"{BASE_URL}/onboarding/clinic", json={
            "name": CLINIC_A_DATA["clinic_name"],
            "address": "123 MG Road",
            "city": "Bangalore",
            "phone": CLINIC_A_DATA["phone"],
            "gstin": "29ABCDE1234F1Z5"
        })
        if resp.status_code != 200:
            results.add_fail("Clinic A onboarding/clinic", f"Status {resp.status_code}: {resp.text}")
            return
        results.add_pass("Clinic A onboarding/clinic successful")
        
        # 1.3 Complete onboarding - working hours
        working_hours = [
            {"day": "Mon", "open": True, "start": "09:00 AM", "end": "06:00 PM"},
            {"day": "Tue", "open": True, "start": "09:00 AM", "end": "06:00 PM"},
            {"day": "Wed", "open": True, "start": "09:00 AM", "end": "06:00 PM"},
            {"day": "Thu", "open": True, "start": "09:00 AM", "end": "06:00 PM"},
            {"day": "Fri", "open": True, "start": "09:00 AM", "end": "06:00 PM"},
            {"day": "Sat", "open": True, "start": "09:00 AM", "end": "02:00 PM"},
            {"day": "Sun", "open": False, "start": "", "end": ""}
        ]
        resp = session_a.post(f"{BASE_URL}/onboarding/hours", json={"working_hours": working_hours})
        if resp.status_code != 200:
            results.add_fail("Clinic A onboarding/hours", f"Status {resp.status_code}: {resp.text}")
            return
        results.add_pass("Clinic A onboarding/hours successful")
        
        # 1.4 Complete onboarding - mark complete
        resp = session_a.post(f"{BASE_URL}/onboarding/complete", json={})
        if resp.status_code != 200:
            results.add_fail("Clinic A onboarding/complete", f"Status {resp.status_code}: {resp.text}")
            return
        results.add_pass("Clinic A onboarding complete")
        
    except Exception as e:
        results.add_fail("Clinic A setup", str(e))
        return
    
    # Step 2: Create patient P1 with specific details
    print_info("Step 2: Create patient P1 (Test Patient, 9888777666, age 30, allergies Penicillin)...")
    patient_id = None
    try:
        resp = session_a.post(f"{BASE_URL}/patients", json={
            "name": "Test Patient",
            "phone": "9888777666",
            "age": 30,
            "allergies": "Penicillin"
        })
        if resp.status_code != 200:
            results.add_fail("Create patient P1", f"Status {resp.status_code}: {resp.text}")
            return
        data = resp.json()
        patient_id = data.get('id')
        if not patient_id:
            results.add_fail("Create patient P1", "No patient ID returned")
            return
        results.add_pass(f"Patient P1 created successfully (ID: {patient_id})")
    except Exception as e:
        results.add_fail("Create patient P1", str(e))
        return
    
    # Step 3: Test generate-summary without any visits → expect 400 with "No visits"
    print_info("Step 3: POST /api/generate-summary without visits → expect 400...")
    try:
        resp = session_a.post(f"{BASE_URL}/generate-summary", json={"patient_id": patient_id})
        if resp.status_code != 400:
            results.add_fail("Generate summary without visits (status check)", f"Expected 400, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            error_msg = data.get('error', '').lower()
            if 'no visits' in error_msg or 'visit' in error_msg:
                results.add_pass(f"Generate summary without visits correctly rejected with 400 (error: '{data.get('error')}')")
            else:
                results.add_fail("Generate summary without visits (error message)", f"Expected error containing 'No visits', got: {data.get('error')}")
    except Exception as e:
        results.add_fail("Generate summary without visits", str(e))
    
    # Step 4: Create one appointment + one completed visit with diagnosis and treatment
    print_info("Step 4: Create appointment and completed visit for P1...")
    appointment_id = None
    visit_id = None
    try:
        # 4.1 Create appointment for today
        resp = session_a.post(f"{BASE_URL}/appointments", json={
            "patient_id": patient_id,
            "appointment_date": today_iso(),
            "appointment_time": "10:00 AM",
            "chief_complaint": "Tooth pain"
        })
        if resp.status_code != 200:
            results.add_fail("Create appointment for P1", f"Status {resp.status_code}: {resp.text}")
            return
        data = resp.json()
        appointment_id = data.get('id')
        if not appointment_id:
            results.add_fail("Create appointment for P1", "No appointment ID returned")
            return
        results.add_pass(f"Appointment created for P1 (ID: {appointment_id})")
        
        # 4.2 Create visit linked to appointment
        resp = session_a.post(f"{BASE_URL}/visits", json={
            "patient_id": patient_id,
            "appointment_id": appointment_id,
            "chief_complaint": "Tooth pain"
        })
        if resp.status_code != 200:
            results.add_fail("Create visit for P1", f"Status {resp.status_code}: {resp.text}")
            return
        data = resp.json()
        visit_id = data.get('id')
        if not visit_id:
            results.add_fail("Create visit for P1", "No visit ID returned")
            return
        results.add_pass(f"Visit created for P1 (ID: {visit_id})")
        
        # 4.3 Complete visit with diagnosis and treatment
        resp = session_a.put(f"{BASE_URL}/visits/{visit_id}", json={
            "diagnosis": "Caries 36",
            "treatment_done": "Composite filling",
            "complete": True
        })
        if resp.status_code != 200:
            results.add_fail("Complete visit for P1", f"Status {resp.status_code}: {resp.text}")
            return
        results.add_pass("Visit completed with diagnosis 'Caries 36' and treatment 'Composite filling'")
        
    except Exception as e:
        results.add_fail("Create appointment/visit for P1", str(e))
        return
    
    # Step 5: POST /api/generate-summary → expect 200 with specific fields
    print_info("Step 5: POST /api/generate-summary with valid patient → expect 200 (may take up to 30s)...")
    generated_summary = None
    generated_at = None
    try:
        resp = session_a.post(f"{BASE_URL}/generate-summary", json={"patient_id": patient_id}, timeout=35)
        if resp.status_code != 200:
            results.add_fail("Generate summary with visits (status check)", f"Expected 200, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            
            # Check body.ok === true
            if data.get('ok') != True:
                results.add_fail("Generate summary (ok field)", f"Expected ok=true, got: {data.get('ok')}")
            else:
                results.add_pass("Generate summary response has ok=true")
            
            # Check body.summary is a non-empty string at least 50 chars
            generated_summary = data.get('summary', '')
            if not isinstance(generated_summary, str):
                results.add_fail("Generate summary (summary type)", f"Expected string, got: {type(generated_summary)}")
            elif len(generated_summary) < 50:
                results.add_fail("Generate summary (summary length)", f"Expected at least 50 chars, got: {len(generated_summary)}")
            else:
                results.add_pass(f"Generate summary response has valid summary (length: {len(generated_summary)} chars)")
                print_info(f"Summary preview: {generated_summary[:100]}...")
            
            # Check body.generated_at is a valid ISO date string
            generated_at = data.get('generated_at')
            if not generated_at:
                results.add_fail("Generate summary (generated_at missing)", "generated_at field is missing")
            else:
                try:
                    # Try to parse as ISO date
                    datetime.fromisoformat(str(generated_at).replace('Z', '+00:00'))
                    results.add_pass(f"Generate summary response has valid generated_at: {generated_at}")
                except:
                    results.add_fail("Generate summary (generated_at format)", f"Invalid ISO date format: {generated_at}")
    except requests.exceptions.Timeout:
        results.add_fail("Generate summary with visits", "Request timeout (>35s)")
    except Exception as e:
        results.add_fail("Generate summary with visits", str(e))
    
    # Step 6: GET /api/patients/:id → verify ai_summary and ai_summary_generated_at
    print_info("Step 6: GET /api/patients/:id → verify ai_summary persisted...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients/{patient_id}")
        if resp.status_code != 200:
            results.add_fail("Get patient P1 after summary", f"Status {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            patient = data.get('patient', {})
            
            # Check ai_summary matches what was returned
            if patient.get('ai_summary') != generated_summary:
                results.add_fail("Patient ai_summary persistence", f"Summary mismatch. Expected length {len(generated_summary) if generated_summary else 0}, got {len(patient.get('ai_summary', ''))}")
            else:
                results.add_pass("Patient ai_summary correctly persisted")
            
            # Check ai_summary_generated_at is populated
            if not patient.get('ai_summary_generated_at'):
                results.add_fail("Patient ai_summary_generated_at", "Field is missing or null")
            else:
                results.add_pass(f"Patient ai_summary_generated_at populated: {patient.get('ai_summary_generated_at')}")
    except Exception as e:
        results.add_fail("Get patient P1 after summary", str(e))
    
    # Step 7: MULTI-TENANT - Sign up Clinic B and try to access Clinic A's patient → expect 404
    print_info("Step 7: MULTI-TENANT - Clinic B tries to generate summary for Clinic A's patient → expect 404...")
    session_b = requests.Session()
    try:
        # 7.1 Signup Clinic B
        resp = session_b.post(f"{BASE_URL}/auth/signup", json=CLINIC_B_DATA)
        if resp.status_code != 200:
            results.add_fail("Clinic B signup", f"Status {resp.status_code}: {resp.text}")
        else:
            results.add_pass("Clinic B signup successful")
            
            # 7.2 Try to generate summary for Clinic A's patient
            resp = session_b.post(f"{BASE_URL}/generate-summary", json={"patient_id": patient_id})
            if resp.status_code != 404:
                results.add_fail("Multi-tenant isolation (generate-summary)", f"Expected 404, got {resp.status_code}: {resp.text}")
            else:
                data = resp.json()
                error_msg = data.get('error', '').lower()
                if 'patient not found' in error_msg or 'not found' in error_msg:
                    results.add_pass(f"Multi-tenant isolation verified: Clinic B cannot generate summary for Clinic A's patient (404: '{data.get('error')}')")
                else:
                    results.add_fail("Multi-tenant isolation (error message)", f"Expected 'Patient not found', got: {data.get('error')}")
    except Exception as e:
        results.add_fail("Multi-tenant isolation test", str(e))
    
    # Step 8: Unauthenticated session → expect 401
    print_info("Step 8: Unauthenticated request to /api/generate-summary → expect 401...")
    try:
        session_unauth = requests.Session()
        resp = session_unauth.post(f"{BASE_URL}/generate-summary", json={"patient_id": patient_id})
        if resp.status_code != 401:
            results.add_fail("Unauthenticated generate-summary", f"Expected 401, got {resp.status_code}: {resp.text}")
        else:
            results.add_pass(f"Unauthenticated request correctly rejected with 401")
    except Exception as e:
        results.add_fail("Unauthenticated generate-summary", str(e))
    
    # Step 9: Invalid patient_id → expect 404
    print_info("Step 9: Generate summary with invalid patient_id → expect 404...")
    try:
        fake_uuid = "00000000-0000-0000-0000-000000000000"
        resp = session_a.post(f"{BASE_URL}/generate-summary", json={"patient_id": fake_uuid})
        if resp.status_code != 404:
            results.add_fail("Generate summary with invalid patient_id", f"Expected 404, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            results.add_pass(f"Invalid patient_id correctly rejected with 404 (error: '{data.get('error')}')")
    except Exception as e:
        results.add_fail("Generate summary with invalid patient_id", str(e))
    
    # Step 10: Missing patient_id → expect 400
    print_info("Step 10: Generate summary without patient_id → expect 400...")
    try:
        resp = session_a.post(f"{BASE_URL}/generate-summary", json={})
        if resp.status_code != 400:
            results.add_fail("Generate summary without patient_id", f"Expected 400, got {resp.status_code}: {resp.text}")
        else:
            data = resp.json()
            error_msg = data.get('error', '').lower()
            if 'patient_id' in error_msg or 'required' in error_msg:
                results.add_pass(f"Missing patient_id correctly rejected with 400 (error: '{data.get('error')}')")
            else:
                results.add_fail("Generate summary without patient_id (error message)", f"Expected error containing 'patient_id', got: {data.get('error')}")
    except Exception as e:
        results.add_fail("Generate summary without patient_id", str(e))

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print(f"\n{'='*80}")
    print("DentOS Backend API Test Suite - Phase 4")
    print("Testing AI Patient Summary endpoint")
    print(f"Base URL: {BASE_URL}")
    print(f"Today: {today_iso()}")
    print('='*80)
    
    test_phase4_ai_patient_summary()
    
    # Print summary
    success = results.summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

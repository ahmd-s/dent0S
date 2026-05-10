#!/usr/bin/env python3
"""
DentOS Backend API Test Suite - Phase 2
Tests multi-tenant SaaS clinic management system with JWT cookie auth
Includes Phase 2: Visits, enriched appointments, patient filters, reshaped dashboard
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
# TEST 1: AUTH + MULTI-TENANT ISOLATION
# ============================================================================

def test_auth_and_multi_tenant():
    print_test("1. AUTH + MULTI-TENANT ISOLATION")
    
    # Create sessions for two clinics
    session_a = requests.Session()
    session_b = requests.Session()
    
    # Test 1.1: Signup Clinic A
    print_info("1.1 Testing Clinic A signup...")
    try:
        resp = session_a.post(f"{BASE_URL}/auth/signup", json=CLINIC_A_DATA)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok'):
                # Check if cookie is set
                if 'dentos_token' in session_a.cookies:
                    results.add_pass("Clinic A signup successful with cookie set")
                else:
                    results.add_fail("Clinic A signup", "Cookie 'dentos_token' not set")
            else:
                results.add_fail("Clinic A signup", f"Response ok=false: {data}")
        else:
            results.add_fail("Clinic A signup", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Clinic A signup", str(e))
    
    # Test 1.2: GET /auth/me for Clinic A
    print_info("1.2 Testing GET /auth/me for Clinic A...")
    try:
        resp = session_a.get(f"{BASE_URL}/auth/me")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('profile', {}).get('role') == 'admin':
                results.add_pass("Clinic A /auth/me returns admin role")
            else:
                results.add_fail("Clinic A /auth/me", f"Expected role=admin, got {data.get('profile', {}).get('role')}")
            
            if data.get('clinic', {}).get('onboarding_complete') == False:
                results.add_pass("Clinic A onboarding_complete is False initially")
            else:
                results.add_fail("Clinic A /auth/me", f"Expected onboarding_complete=false, got {data.get('clinic', {}).get('onboarding_complete')}")
        else:
            results.add_fail("Clinic A /auth/me", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Clinic A /auth/me", str(e))
    
    # Test 1.3: Signup Clinic B
    print_info("1.3 Testing Clinic B signup...")
    try:
        resp = session_b.post(f"{BASE_URL}/auth/signup", json=CLINIC_B_DATA)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and 'dentos_token' in session_b.cookies:
                results.add_pass("Clinic B signup successful with cookie set")
            else:
                results.add_fail("Clinic B signup", f"Cookie not set or ok=false: {data}")
        else:
            results.add_fail("Clinic B signup", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Clinic B signup", str(e))
    
    # Test 1.4: Duplicate email signup
    print_info("1.4 Testing duplicate email signup (should fail)...")
    try:
        duplicate_data = CLINIC_A_DATA.copy()
        resp = requests.post(f"{BASE_URL}/auth/signup", json=duplicate_data)
        if resp.status_code == 400:
            results.add_pass("Duplicate email signup correctly rejected with 400")
        else:
            results.add_fail("Duplicate email signup", f"Expected 400, got {resp.status_code}")
    except Exception as e:
        results.add_fail("Duplicate email signup", str(e))
    
    # Test 1.5: Logout and verify unauthorized
    print_info("1.5 Testing logout...")
    try:
        resp = session_a.post(f"{BASE_URL}/auth/logout")
        if resp.status_code == 200:
            results.add_pass("Logout successful")
            
            # Try to access /auth/me after logout
            resp = session_a.get(f"{BASE_URL}/auth/me")
            if resp.status_code == 401:
                results.add_pass("GET /auth/me after logout returns 401")
            else:
                results.add_fail("GET /auth/me after logout", f"Expected 401, got {resp.status_code}")
        else:
            results.add_fail("Logout", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Logout", str(e))
    
    # Test 1.6: Login with bad password
    print_info("1.6 Testing login with bad password...")
    try:
        bad_login = {"email": CLINIC_A_DATA["email"], "password": "wrongpassword"}
        resp = requests.post(f"{BASE_URL}/auth/login", json=bad_login)
        if resp.status_code == 401:
            results.add_pass("Login with bad password correctly rejected with 401")
        else:
            results.add_fail("Login with bad password", f"Expected 401, got {resp.status_code}")
    except Exception as e:
        results.add_fail("Login with bad password", str(e))
    
    # Test 1.7: Login with correct credentials
    print_info("1.7 Testing login with correct credentials...")
    try:
        good_login = {"email": CLINIC_A_DATA["email"], "password": CLINIC_A_DATA["password"]}
        resp = session_a.post(f"{BASE_URL}/auth/login", json=good_login)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and 'onboarding_complete' in data:
                results.add_pass("Login successful with onboarding_complete flag")
            else:
                results.add_fail("Login", f"Missing ok or onboarding_complete: {data}")
        else:
            results.add_fail("Login", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Login", str(e))
    
    return session_a, session_b

# ============================================================================
# TEST 2: ONBOARDING FLOW
# ============================================================================

def test_onboarding(session_a):
    print_test("2. ONBOARDING FLOW")
    
    # Test 2.1: POST /onboarding/clinic
    print_info("2.1 Testing POST /onboarding/clinic...")
    try:
        clinic_data = {
            "name": "Clinic Alpha Dental Care",
            "address": "123 MG Road, Bangalore",
            "city": "Bangalore",
            "phone": "9876543210",
            "gstin": "29ABCDE1234F1Z5",
            "logo_url": "https://example.com/logo.png"
        }
        resp = session_a.post(f"{BASE_URL}/onboarding/clinic", json=clinic_data)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("POST /onboarding/clinic successful")
        else:
            results.add_fail("POST /onboarding/clinic", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /onboarding/clinic", str(e))
    
    # Test 2.2: POST /onboarding/hours
    print_info("2.2 Testing POST /onboarding/hours...")
    try:
        hours_data = {
            "working_hours": [
                {"day": "Monday", "is_open": True, "open_time": "09:00", "close_time": "18:00"},
                {"day": "Tuesday", "is_open": True, "open_time": "09:00", "close_time": "18:00"},
                {"day": "Wednesday", "is_open": True, "open_time": "09:00", "close_time": "18:00"},
                {"day": "Thursday", "is_open": True, "open_time": "09:00", "close_time": "18:00"},
                {"day": "Friday", "is_open": True, "open_time": "09:00", "close_time": "18:00"},
                {"day": "Saturday", "is_open": True, "open_time": "09:00", "close_time": "14:00"},
                {"day": "Sunday", "is_open": False, "open_time": "", "close_time": ""}
            ]
        }
        resp = session_a.post(f"{BASE_URL}/onboarding/hours", json=hours_data)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("POST /onboarding/hours successful")
        else:
            results.add_fail("POST /onboarding/hours", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /onboarding/hours", str(e))
    
    # Test 2.3: POST /onboarding/team
    print_info("2.3 Testing POST /onboarding/team...")
    try:
        team_data = {
            "full_name": "Dr. Amit Verma",
            "email": f"amit.verma.{datetime.now().timestamp()}@clinicalpha.in",
            "role": "doctor",
            "password": "password123"
        }
        resp = session_a.post(f"{BASE_URL}/onboarding/team", json=team_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                results.add_pass("POST /onboarding/team successful with id returned")
                
                # Test 2.4: Duplicate team email
                print_info("2.4 Testing duplicate team email...")
                resp = session_a.post(f"{BASE_URL}/onboarding/team", json=team_data)
                if resp.status_code == 400:
                    results.add_pass("Duplicate team email correctly rejected with 400")
                else:
                    results.add_fail("Duplicate team email", f"Expected 400, got {resp.status_code}")
            else:
                results.add_fail("POST /onboarding/team", f"Missing ok or id: {data}")
        else:
            results.add_fail("POST /onboarding/team", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /onboarding/team", str(e))
    
    # Test 2.5: POST /onboarding/complete
    print_info("2.5 Testing POST /onboarding/complete...")
    try:
        resp = session_a.post(f"{BASE_URL}/onboarding/complete")
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("POST /onboarding/complete successful")
            
            # Verify onboarding_complete is true
            resp = session_a.get(f"{BASE_URL}/auth/me")
            if resp.status_code == 200:
                data = resp.json()
                if data.get('clinic', {}).get('onboarding_complete') == True:
                    results.add_pass("Clinic onboarding_complete is True after completion")
                else:
                    results.add_fail("Onboarding verification", f"Expected onboarding_complete=true, got {data.get('clinic', {}).get('onboarding_complete')}")
        else:
            results.add_fail("POST /onboarding/complete", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /onboarding/complete", str(e))

# ============================================================================
# TEST 3: PATIENTS CRUD + MULTI-TENANT ISOLATION (CRITICAL)
# ============================================================================

def test_patients_multi_tenant(session_a, session_b):
    print_test("3. PATIENTS CRUD + MULTI-TENANT ISOLATION (CRITICAL)")
    
    patient_id_a = None
    
    # Test 3.1: Create patient in Clinic A
    print_info("3.1 Testing POST /patients for Clinic A...")
    try:
        patient_data = {
            "name": "Ramesh Kumar",
            "phone": "9000000001",
            "age": 34,
            "gender": "male"
        }
        resp = session_a.post(f"{BASE_URL}/patients", json=patient_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                patient_id_a = data['id']
                results.add_pass(f"POST /patients successful for Clinic A (id: {patient_id_a})")
            else:
                results.add_fail("POST /patients Clinic A", f"Missing ok or id: {data}")
        else:
            results.add_fail("POST /patients Clinic A", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /patients Clinic A", str(e))
    
    # Test 3.2: GET /patients for Clinic A
    print_info("3.2 Testing GET /patients for Clinic A...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if any(p.get('name') == 'Ramesh Kumar' for p in patients):
                results.add_pass("GET /patients returns Ramesh Kumar for Clinic A")
            else:
                results.add_fail("GET /patients Clinic A", f"Ramesh Kumar not found in list: {patients}")
        else:
            results.add_fail("GET /patients Clinic A", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /patients Clinic A", str(e))
    
    # Test 3.3: Search by name
    print_info("3.3 Testing GET /patients?q=ramesh...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients?q=ramesh")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if len(patients) >= 1 and any('Ramesh' in p.get('name', '') for p in patients):
                results.add_pass("Search by name 'ramesh' returns results")
            else:
                results.add_fail("Search by name", f"Expected at least 1 result with Ramesh, got {len(patients)}")
        else:
            results.add_fail("Search by name", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Search by name", str(e))
    
    # Test 3.4: Search by phone
    print_info("3.4 Testing GET /patients?q=9000000001...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients?q=9000000001")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if len(patients) >= 1:
                results.add_pass("Search by phone '9000000001' returns results")
            else:
                results.add_fail("Search by phone", f"Expected at least 1 result, got {len(patients)}")
        else:
            results.add_fail("Search by phone", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Search by phone", str(e))
    
    # Test 3.5: POST without required fields
    print_info("3.5 Testing POST /patients without name (should fail)...")
    try:
        bad_data = {"phone": "9000000002"}
        resp = session_a.post(f"{BASE_URL}/patients", json=bad_data)
        if resp.status_code == 400:
            results.add_pass("POST /patients without name correctly rejected with 400")
        else:
            results.add_fail("POST /patients validation", f"Expected 400, got {resp.status_code}")
    except Exception as e:
        results.add_fail("POST /patients validation", str(e))
    
    # Test 3.6: GET /patients/:id for Clinic A
    if patient_id_a:
        print_info(f"3.6 Testing GET /patients/{patient_id_a} for Clinic A...")
        try:
            resp = session_a.get(f"{BASE_URL}/patients/{patient_id_a}")
            if resp.status_code == 200:
                data = resp.json()
                if data.get('patient', {}).get('name') == 'Ramesh Kumar':
                    results.add_pass("GET /patients/:id returns correct patient for Clinic A")
                else:
                    results.add_fail("GET /patients/:id", f"Expected Ramesh Kumar, got {data.get('patient', {}).get('name')}")
            else:
                results.add_fail("GET /patients/:id Clinic A", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("GET /patients/:id Clinic A", str(e))
    
    # Test 3.7: PUT /patients/:id
    if patient_id_a:
        print_info(f"3.7 Testing PUT /patients/{patient_id_a} with allergies...")
        try:
            update_data = {"allergies": "penicillin"}
            resp = session_a.put(f"{BASE_URL}/patients/{patient_id_a}", json=update_data)
            if resp.status_code == 200 and resp.json().get('ok'):
                results.add_pass("PUT /patients/:id successful")
                
                # Verify update
                resp = session_a.get(f"{BASE_URL}/patients/{patient_id_a}")
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('patient', {}).get('allergies') == 'penicillin':
                        results.add_pass("Patient allergies updated correctly")
                    else:
                        results.add_fail("Patient update verification", f"Expected allergies='penicillin', got {data.get('patient', {}).get('allergies')}")
            else:
                results.add_fail("PUT /patients/:id", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("PUT /patients/:id", str(e))
    
    # ========================================================================
    # CRITICAL: MULTI-TENANT ISOLATION TEST
    # ========================================================================
    print_info("3.8 CRITICAL: Testing multi-tenant isolation...")
    
    # Test 3.8a: Clinic B should NOT see Ramesh Kumar
    print_info("3.8a Testing GET /patients for Clinic B (should NOT include Ramesh)...")
    try:
        resp = session_b.get(f"{BASE_URL}/patients")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if not any(p.get('name') == 'Ramesh Kumar' for p in patients):
                results.add_pass("CRITICAL: Clinic B cannot see Clinic A's patient (multi-tenant isolation working)")
            else:
                results.add_fail("CRITICAL: Multi-tenant isolation", "Clinic B can see Clinic A's patient - SECURITY BREACH!")
        else:
            results.add_fail("GET /patients Clinic B", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /patients Clinic B", str(e))
    
    # Test 3.8b: Clinic B should get 404 for Ramesh's ID
    if patient_id_a:
        print_info(f"3.8b Testing GET /patients/{patient_id_a} from Clinic B (should return 404)...")
        try:
            resp = session_b.get(f"{BASE_URL}/patients/{patient_id_a}")
            if resp.status_code == 404:
                results.add_pass("CRITICAL: Clinic B gets 404 for Clinic A's patient ID (multi-tenant isolation working)")
            else:
                results.add_fail("CRITICAL: Multi-tenant isolation", f"Expected 404, got {resp.status_code} - SECURITY BREACH!")
        except Exception as e:
            results.add_fail("GET /patients/:id Clinic B", str(e))
    
    return patient_id_a

# ============================================================================
# TEST 4: APPOINTMENTS CRUD + MULTI-TENANT
# ============================================================================

def test_appointments_multi_tenant(session_a, session_b, patient_id_a):
    print_test("4. APPOINTMENTS CRUD + MULTI-TENANT")
    
    appointment_id_a = None
    test_date = "2025-06-20"
    
    # Test 4.1: Create appointment for Clinic A
    print_info("4.1 Testing POST /appointments for Clinic A...")
    try:
        appt_data = {
            "patient_id": patient_id_a,
            "appointment_date": test_date,
            "appointment_time": "10:30 AM",
            "appointment_type": "new_patient",
            "chief_complaint": "Toothache"
        }
        resp = session_a.post(f"{BASE_URL}/appointments", json=appt_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                appointment_id_a = data['id']
                results.add_pass(f"POST /appointments successful for Clinic A (id: {appointment_id_a})")
            else:
                results.add_fail("POST /appointments Clinic A", f"Missing ok or id: {data}")
        else:
            results.add_fail("POST /appointments Clinic A", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("POST /appointments Clinic A", str(e))
    
    # Test 4.2: GET /appointments?date=2025-06-20 for Clinic A
    print_info(f"4.2 Testing GET /appointments?date={test_date} for Clinic A...")
    try:
        resp = session_a.get(f"{BASE_URL}/appointments?date={test_date}")
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get('appointments', [])
            found = False
            for appt in appointments:
                if appt.get('id') == appointment_id_a and appt.get('patient_name') == 'Ramesh Kumar':
                    found = True
                    break
            if found:
                results.add_pass("GET /appointments includes appointment with patient_name='Ramesh Kumar'")
            else:
                results.add_fail("GET /appointments Clinic A", f"Appointment not found or patient_name missing: {appointments}")
        else:
            results.add_fail("GET /appointments Clinic A", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /appointments Clinic A", str(e))
    
    # Test 4.3: PUT /appointments/:id to update status
    if appointment_id_a:
        print_info(f"4.3 Testing PUT /appointments/{appointment_id_a} to status=completed...")
        try:
            update_data = {"status": "completed"}
            resp = session_a.put(f"{BASE_URL}/appointments/{appointment_id_a}", json=update_data)
            if resp.status_code == 200 and resp.json().get('ok'):
                results.add_pass("PUT /appointments/:id successful")
                
                # Verify status update
                resp = session_a.get(f"{BASE_URL}/appointments?date={test_date}")
                if resp.status_code == 200:
                    data = resp.json()
                    appointments = data.get('appointments', [])
                    appt = next((a for a in appointments if a.get('id') == appointment_id_a), None)
                    if appt and appt.get('status') == 'completed':
                        results.add_pass("Appointment status updated to 'completed'")
                    else:
                        results.add_fail("Appointment status verification", f"Expected status='completed', got {appt.get('status') if appt else 'not found'}")
            else:
                results.add_fail("PUT /appointments/:id", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("PUT /appointments/:id", str(e))
    
    # Test 4.4: CRITICAL - Clinic B should NOT see Clinic A's appointment
    print_info(f"4.4 CRITICAL: Testing GET /appointments?date={test_date} for Clinic B (should be empty)...")
    try:
        resp = session_b.get(f"{BASE_URL}/appointments?date={test_date}")
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get('appointments', [])
            if len(appointments) == 0:
                results.add_pass("CRITICAL: Clinic B cannot see Clinic A's appointments (multi-tenant isolation working)")
            else:
                results.add_fail("CRITICAL: Appointments multi-tenant isolation", f"Clinic B can see {len(appointments)} appointments - SECURITY BREACH!")
        else:
            results.add_fail("GET /appointments Clinic B", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /appointments Clinic B", str(e))

# ============================================================================
# TEST 5: DASHBOARD STATS (PHASE 2 RESHAPED)
# ============================================================================

def test_dashboard_stats_phase2(session_a):
    print_test("5. DASHBOARD STATS (PHASE 2 RESHAPED)")
    
    print_info("5.1 Testing GET /dashboard/stats for Clinic A (new shape)...")
    try:
        resp = session_a.get(f"{BASE_URL}/dashboard/stats")
        if resp.status_code == 200:
            data = resp.json()
            
            # Check NEW required fields (old fields removed)
            required_fields = ['clinic_name', 'patients_seen_today', 'patients_seen_yesterday', 
                             'revenue_today', 'pending_today', 'followups_due_count', 
                             'today_queue', 'followups']
            missing = [f for f in required_fields if f not in data]
            
            if not missing:
                results.add_pass("Dashboard stats contains all NEW Phase 2 fields")
                
                # Verify data types
                if isinstance(data['clinic_name'], str):
                    results.add_pass(f"clinic_name is string (value: {data['clinic_name']})")
                else:
                    results.add_fail("Dashboard stats", f"clinic_name should be string, got {type(data['clinic_name'])}")
                
                if isinstance(data['patients_seen_today'], int):
                    results.add_pass(f"patients_seen_today is int (value: {data['patients_seen_today']})")
                else:
                    results.add_fail("Dashboard stats", f"patients_seen_today should be int, got {type(data['patients_seen_today'])}")
                
                if isinstance(data['patients_seen_yesterday'], int):
                    results.add_pass(f"patients_seen_yesterday is int (value: {data['patients_seen_yesterday']})")
                else:
                    results.add_fail("Dashboard stats", f"patients_seen_yesterday should be int, got {type(data['patients_seen_yesterday'])}")
                
                if isinstance(data['revenue_today'], (int, float)):
                    results.add_pass(f"revenue_today is number (value: {data['revenue_today']})")
                else:
                    results.add_fail("Dashboard stats", f"revenue_today should be number, got {type(data['revenue_today'])}")
                
                if isinstance(data['pending_today'], (int, float)):
                    results.add_pass(f"pending_today is number (value: {data['pending_today']})")
                else:
                    results.add_fail("Dashboard stats", f"pending_today should be number, got {type(data['pending_today'])}")
                
                if isinstance(data['followups_due_count'], int):
                    results.add_pass(f"followups_due_count is int (value: {data['followups_due_count']})")
                else:
                    results.add_fail("Dashboard stats", f"followups_due_count should be int, got {type(data['followups_due_count'])}")
                
                if isinstance(data['today_queue'], list):
                    results.add_pass(f"today_queue is array (length: {len(data['today_queue'])})")
                    # Check if items have required fields
                    if len(data['today_queue']) > 0:
                        item = data['today_queue'][0]
                        if 'patient_name' in item and 'doctor_name' in item and 'visit_id' in item:
                            results.add_pass("today_queue items have patient_name, doctor_name, visit_id")
                        else:
                            results.add_fail("Dashboard stats", f"today_queue items missing required fields: {item.keys()}")
                else:
                    results.add_fail("Dashboard stats", f"today_queue should be array, got {type(data['today_queue'])}")
                
                if isinstance(data['followups'], list):
                    results.add_pass(f"followups is array (length: {len(data['followups'])})")
                else:
                    results.add_fail("Dashboard stats", f"followups should be array, got {type(data['followups'])}")
                
                # Verify OLD fields are REMOVED
                old_fields = ['total_patients', 'monthly_revenue', 'today_appointments', 'today_list', 'recent_patients', 'pending_invoices']
                present_old = [f for f in old_fields if f in data]
                if not present_old:
                    results.add_pass("Old Phase 1 fields correctly removed from dashboard stats")
                else:
                    results.add_fail("Dashboard stats", f"Old fields still present (should be removed): {present_old}")
            else:
                results.add_fail("Dashboard stats", f"Missing NEW fields: {missing}")
        else:
            results.add_fail("GET /dashboard/stats", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /dashboard/stats", str(e))

# ============================================================================
# TEST 6: PATIENT FILTERS + PATIENT_CODE FORMAT (PHASE 2)
# ============================================================================

def test_patient_filters(session_a):
    print_test("6. PATIENT FILTERS + PATIENT_CODE FORMAT (PHASE 2)")
    
    # Test 6.1: Create a fresh patient (no visits yet)
    print_info("6.1 Creating fresh patient for filter testing...")
    fresh_patient_id = None
    try:
        patient_data = {
            "name": "Anjali Reddy",
            "phone": "9123456789",
            "age": 28,
            "gender": "female"
        }
        resp = session_a.post(f"{BASE_URL}/patients", json=patient_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                fresh_patient_id = data['id']
                results.add_pass(f"Fresh patient created (id: {fresh_patient_id})")
            else:
                results.add_fail("Create fresh patient", f"Missing ok or id: {data}")
        else:
            results.add_fail("Create fresh patient", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Create fresh patient", str(e))
    
    # Test 6.2: Verify patient_code format (PT00001)
    if fresh_patient_id:
        print_info("6.2 Verifying patient_code format...")
        try:
            resp = session_a.get(f"{BASE_URL}/patients/{fresh_patient_id}")
            if resp.status_code == 200:
                data = resp.json()
                patient_code = data.get('patient', {}).get('patient_code', '')
                import re
                if re.match(r'^PT\d{5}$', patient_code):
                    results.add_pass(f"patient_code format correct: {patient_code}")
                else:
                    results.add_fail("patient_code format", f"Expected PT##### format, got: {patient_code}")
            else:
                results.add_fail("GET patient for code check", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("patient_code format check", str(e))
    
    # Test 6.3: filter=inactive (should INCLUDE fresh patient with no visits)
    print_info("6.3 Testing GET /patients?filter=inactive...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients?filter=inactive")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if isinstance(patients, list):
                results.add_pass(f"filter=inactive returns array (length: {len(patients)})")
                # Check if fresh patient is included
                if fresh_patient_id and any(p.get('id') == fresh_patient_id for p in patients):
                    results.add_pass("Fresh patient (no visits) included in filter=inactive")
                elif fresh_patient_id:
                    results.add_fail("filter=inactive", "Fresh patient should be included but not found")
            else:
                results.add_fail("filter=inactive", f"Expected array, got {type(patients)}")
        else:
            results.add_fail("GET /patients?filter=inactive", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /patients?filter=inactive", str(e))
    
    # Test 6.4: filter=week (should EXCLUDE fresh patient with no visits)
    print_info("6.4 Testing GET /patients?filter=week...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients?filter=week")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if isinstance(patients, list):
                results.add_pass(f"filter=week returns array (length: {len(patients)})")
                # Check if fresh patient is excluded
                if fresh_patient_id and not any(p.get('id') == fresh_patient_id for p in patients):
                    results.add_pass("Fresh patient (no visits) correctly excluded from filter=week")
                elif fresh_patient_id and any(p.get('id') == fresh_patient_id for p in patients):
                    results.add_fail("filter=week", "Fresh patient should be excluded but found")
            else:
                results.add_fail("filter=week", f"Expected array, got {type(patients)}")
        else:
            results.add_fail("GET /patients?filter=week", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /patients?filter=week", str(e))
    
    # Test 6.5: filter=month
    print_info("6.5 Testing GET /patients?filter=month...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients?filter=month")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if isinstance(patients, list):
                results.add_pass(f"filter=month returns array (length: {len(patients)})")
            else:
                results.add_fail("filter=month", f"Expected array, got {type(patients)}")
        else:
            results.add_fail("GET /patients?filter=month", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /patients?filter=month", str(e))
    
    return fresh_patient_id

# ============================================================================
# TEST 7: VISITS FULL FLOW (CRITICAL PHASE 2)
# ============================================================================

def test_visits_full_flow(session_a, session_b):
    print_test("7. VISITS FULL FLOW (CRITICAL PHASE 2)")
    
    today = today_iso()
    print_info(f"Using today's date: {today}")
    
    # Test 7.1: Create patient P1
    print_info("7.1 Creating patient P1...")
    patient_id = None
    try:
        patient_data = {
            "name": "Vikram Singh",
            "phone": "9876543299",
            "age": 42,
            "gender": "male"
        }
        resp = session_a.post(f"{BASE_URL}/patients", json=patient_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                patient_id = data['id']
                results.add_pass(f"Patient P1 created (id: {patient_id})")
            else:
                results.add_fail("Create patient P1", f"Missing ok or id: {data}")
        else:
            results.add_fail("Create patient P1", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Create patient P1", str(e))
    
    if not patient_id:
        print_fail("Cannot continue visits flow without patient_id")
        return None
    
    # Test 7.2: Create appointment A1 for today
    print_info("7.2 Creating appointment A1 for today...")
    appointment_id = None
    try:
        appt_data = {
            "patient_id": patient_id,
            "appointment_date": today,
            "appointment_time": "11:00 AM",
            "appointment_type": "consultation",
            "chief_complaint": "Toothache"
        }
        resp = session_a.post(f"{BASE_URL}/appointments", json=appt_data)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('ok') and data.get('id'):
                appointment_id = data['id']
                results.add_pass(f"Appointment A1 created for today (id: {appointment_id})")
            else:
                results.add_fail("Create appointment A1", f"Missing ok or id: {data}")
        else:
            results.add_fail("Create appointment A1", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Create appointment A1", str(e))
    
    if not appointment_id:
        print_fail("Cannot continue visits flow without appointment_id")
        return None
    
    # Test 7.3: POST /api/visits to create visit V1
    print_info("7.3 Creating visit V1 with appointment_id...")
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
            if data.get('ok') and data.get('id'):
                visit_id = data['id']
                results.add_pass(f"Visit V1 created (id: {visit_id})")
            else:
                results.add_fail("Create visit V1", f"Missing ok or id: {data}")
        else:
            results.add_fail("Create visit V1", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Create visit V1", str(e))
    
    if not visit_id:
        print_fail("Cannot continue visits flow without visit_id")
        return None
    
    # Test 7.4: Verify appointment status changed to 'in_progress' and visit_id is set
    print_info("7.4 Verifying appointment A1 status='in_progress' and visit_id set...")
    try:
        resp = session_a.get(f"{BASE_URL}/appointments?date={today}")
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get('appointments', [])
            appt = next((a for a in appointments if a.get('id') == appointment_id), None)
            if appt:
                if appt.get('status') == 'in_progress':
                    results.add_pass("Appointment A1 status changed to 'in_progress'")
                else:
                    results.add_fail("Appointment status check", f"Expected 'in_progress', got '{appt.get('status')}'")
                
                if appt.get('visit_id') == visit_id:
                    results.add_pass(f"Appointment A1 visit_id set to {visit_id}")
                else:
                    results.add_fail("Appointment visit_id check", f"Expected visit_id={visit_id}, got {appt.get('visit_id')}")
            else:
                results.add_fail("Appointment status check", f"Appointment {appointment_id} not found")
        else:
            results.add_fail("GET appointments for status check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Appointment status check", str(e))
    
    # Test 7.5: GET /api/visits/:id to verify visit details
    print_info("7.5 Testing GET /api/visits/:id...")
    try:
        resp = session_a.get(f"{BASE_URL}/visits/{visit_id}")
        if resp.status_code == 200:
            data = resp.json()
            visit = data.get('visit', {})
            if visit.get('id') == visit_id:
                results.add_pass("GET /visits/:id returns correct visit")
                
                # Check for patient_name, doctor_name, prescriptions
                if 'patient_name' in visit and visit['patient_name']:
                    results.add_pass(f"Visit has patient_name: {visit['patient_name']}")
                else:
                    results.add_fail("Visit patient_name", "patient_name missing or empty")
                
                if 'doctor_name' in visit:
                    results.add_pass(f"Visit has doctor_name: {visit['doctor_name']}")
                else:
                    results.add_fail("Visit doctor_name", "doctor_name missing")
                
                if isinstance(visit.get('prescriptions'), list):
                    results.add_pass(f"Visit has prescriptions array (length: {len(visit['prescriptions'])})")
                else:
                    results.add_fail("Visit prescriptions", f"Expected array, got {type(visit.get('prescriptions'))}")
            else:
                results.add_fail("GET /visits/:id", f"Expected visit id {visit_id}, got {visit.get('id')}")
        else:
            results.add_fail("GET /visits/:id", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /visits/:id", str(e))
    
    # Test 7.6: GET /api/visits?patient_id=P1
    print_info("7.6 Testing GET /api/visits?patient_id=P1...")
    try:
        resp = session_a.get(f"{BASE_URL}/visits?patient_id={patient_id}")
        if resp.status_code == 200:
            data = resp.json()
            visits = data.get('visits', [])
            if isinstance(visits, list) and len(visits) == 1:
                results.add_pass(f"GET /visits?patient_id returns 1 visit")
                if visits[0].get('id') == visit_id:
                    results.add_pass("Visit V1 found in patient visits list")
                else:
                    results.add_fail("Patient visits list", f"Expected visit {visit_id}, got {visits[0].get('id')}")
            else:
                results.add_fail("GET /visits?patient_id", f"Expected 1 visit, got {len(visits)}")
        else:
            results.add_fail("GET /visits?patient_id", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /visits?patient_id", str(e))
    
    # Test 7.7: PUT /api/visits/:id with complete=true and prescriptions
    print_info("7.7 Testing PUT /api/visits/:id with complete=true...")
    try:
        update_data = {
            "chief_complaint": "Toothache, lower-right molar",
            "diagnosis": "Acute pulpitis #46",
            "treatment_done": "Pulpotomy + temp filling",
            "clinical_notes": "Cold test positive...",
            "treatment_plan": "RCT next visit",
            "next_visit_recommended": True,
            "next_visit_date": "2026-06-01",
            "prescriptions": [
                {
                    "medicine_name": "Amoxicillin",
                    "dosage": "500mg",
                    "frequency": "TID",
                    "duration": "5 days",
                    "instructions": "After food"
                },
                {
                    "medicine_name": "Ibuprofen",
                    "dosage": "400mg",
                    "frequency": "BID",
                    "duration": "3 days"
                },
                {
                    "medicine_name": "",  # Empty medicine_name - should be filtered out
                    "dosage": "ignore me"
                }
            ],
            "complete": True
        }
        resp = session_a.put(f"{BASE_URL}/visits/{visit_id}", json=update_data)
        if resp.status_code == 200 and resp.json().get('ok'):
            results.add_pass("PUT /visits/:id with complete=true successful")
        else:
            results.add_fail("PUT /visits/:id", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("PUT /visits/:id", str(e))
    
    # Test 7.8: VERIFY SIDE EFFECTS
    print_info("7.8 Verifying side effects of complete=true...")
    
    # 7.8a: GET /visits/:id - prescriptions should be 2 (empty one filtered)
    print_info("7.8a Checking prescriptions filtered correctly...")
    try:
        resp = session_a.get(f"{BASE_URL}/visits/{visit_id}")
        if resp.status_code == 200:
            data = resp.json()
            visit = data.get('visit', {})
            prescriptions = visit.get('prescriptions', [])
            if len(prescriptions) == 2:
                results.add_pass("Prescriptions filtered correctly (2 valid, 1 empty removed)")
                # Check if diagnosis and treatment fields are populated
                if visit.get('diagnosis') == "Acute pulpitis #46":
                    results.add_pass("Visit diagnosis updated correctly")
                else:
                    results.add_fail("Visit diagnosis", f"Expected 'Acute pulpitis #46', got '{visit.get('diagnosis')}'")
                
                if visit.get('treatment_done') == "Pulpotomy + temp filling":
                    results.add_pass("Visit treatment_done updated correctly")
                else:
                    results.add_fail("Visit treatment_done", f"Expected 'Pulpotomy + temp filling', got '{visit.get('treatment_done')}'")
            else:
                results.add_fail("Prescriptions filtering", f"Expected 2 prescriptions, got {len(prescriptions)}")
        else:
            results.add_fail("GET /visits/:id for prescriptions check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Prescriptions check", str(e))
    
    # 7.8b: GET /appointments - status should be 'completed'
    print_info("7.8b Checking appointment status changed to 'completed'...")
    try:
        resp = session_a.get(f"{BASE_URL}/appointments?date={today}")
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get('appointments', [])
            appt = next((a for a in appointments if a.get('id') == appointment_id), None)
            if appt and appt.get('status') == 'completed':
                results.add_pass("Appointment status changed to 'completed' after visit completion")
            else:
                results.add_fail("Appointment completion", f"Expected status='completed', got '{appt.get('status') if appt else 'not found'}'")
        else:
            results.add_fail("GET appointments for completion check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Appointment completion check", str(e))
    
    # 7.8c: GET /patients/:id - total_visits=1, last_visit_date=today, next_followup_date set
    print_info("7.8c Checking patient stats updated...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients/{patient_id}")
        if resp.status_code == 200:
            data = resp.json()
            patient = data.get('patient', {})
            
            if patient.get('total_visits') == 1:
                results.add_pass("Patient total_visits incremented to 1")
            else:
                results.add_fail("Patient total_visits", f"Expected 1, got {patient.get('total_visits')}")
            
            if patient.get('last_visit_date') == today:
                results.add_pass(f"Patient last_visit_date set to today ({today})")
            else:
                results.add_fail("Patient last_visit_date", f"Expected {today}, got {patient.get('last_visit_date')}")
            
            if patient.get('next_followup_date') == "2026-06-01":
                results.add_pass("Patient next_followup_date set to 2026-06-01")
            else:
                results.add_fail("Patient next_followup_date", f"Expected 2026-06-01, got {patient.get('next_followup_date')}")
        else:
            results.add_fail("GET /patients/:id for stats check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Patient stats check", str(e))
    
    # 7.8d: GET /dashboard/stats - patients_seen_today should be >= 1
    print_info("7.8d Checking dashboard stats updated...")
    try:
        resp = session_a.get(f"{BASE_URL}/dashboard/stats")
        if resp.status_code == 200:
            data = resp.json()
            if data.get('patients_seen_today', 0) >= 1:
                results.add_pass(f"Dashboard patients_seen_today >= 1 (value: {data.get('patients_seen_today')})")
            else:
                results.add_fail("Dashboard patients_seen_today", f"Expected >= 1, got {data.get('patients_seen_today')}")
        else:
            results.add_fail("GET /dashboard/stats for update check", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Dashboard stats update check", str(e))
    
    # 7.8e: GET /patients?filter=week - P1 should now appear
    print_info("7.8e Checking patient appears in filter=week after visit...")
    try:
        resp = session_a.get(f"{BASE_URL}/patients?filter=week")
        if resp.status_code == 200:
            data = resp.json()
            patients = data.get('patients', [])
            if any(p.get('id') == patient_id for p in patients):
                results.add_pass("Patient P1 now appears in filter=week (has recent visit)")
            else:
                results.add_fail("Patient in filter=week", "Patient P1 should appear after visit completion")
        else:
            results.add_fail("GET /patients?filter=week after visit", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Patient filter=week after visit", str(e))
    
    # Test 7.9: MULTI-TENANT ISOLATION - Clinic B cannot access Clinic A's visit
    print_info("7.9 CRITICAL: Testing multi-tenant isolation for visits...")
    
    # 7.9a: Clinic B GET /visits/:id (should return 404)
    print_info("7.9a Clinic B trying to GET /visits/:id from Clinic A...")
    try:
        resp = session_b.get(f"{BASE_URL}/visits/{visit_id}")
        if resp.status_code == 404:
            results.add_pass("CRITICAL: Clinic B gets 404 for Clinic A's visit (multi-tenant isolation working)")
        else:
            results.add_fail("CRITICAL: Visits multi-tenant isolation", f"Expected 404, got {resp.status_code} - SECURITY BREACH!")
    except Exception as e:
        results.add_fail("Clinic B GET /visits/:id", str(e))
    
    # 7.9b: Clinic B GET /visits?patient_id=P1 (should return empty array)
    print_info("7.9b Clinic B trying to GET /visits?patient_id=P1 from Clinic A...")
    try:
        resp = session_b.get(f"{BASE_URL}/visits?patient_id={patient_id}")
        if resp.status_code == 200:
            data = resp.json()
            visits = data.get('visits', [])
            if len(visits) == 0:
                results.add_pass("CRITICAL: Clinic B gets empty visits array for Clinic A's patient (multi-tenant isolation working)")
            else:
                results.add_fail("CRITICAL: Visits multi-tenant isolation", f"Expected empty array, got {len(visits)} visits - SECURITY BREACH!")
        else:
            results.add_fail("Clinic B GET /visits?patient_id", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("Clinic B GET /visits?patient_id", str(e))
    
    return visit_id

# ============================================================================
# TEST 8: APPOINTMENTS ENRICHED (PHASE 2)
# ============================================================================

def test_appointments_enriched(session_a, patient_id):
    print_test("8. APPOINTMENTS ENRICHED WITH DOCTOR_NAME + VISIT_ID (PHASE 2)")
    
    today = today_iso()
    
    # Test 8.1: GET /appointments?date=today - verify doctor_name and visit_id
    print_info("8.1 Testing GET /appointments?date=today with enriched fields...")
    try:
        resp = session_a.get(f"{BASE_URL}/appointments?date={today}")
        if resp.status_code == 200:
            data = resp.json()
            appointments = data.get('appointments', [])
            if len(appointments) > 0:
                appt = appointments[0]
                
                # Check for doctor_name
                if 'doctor_name' in appt:
                    results.add_pass(f"Appointment has doctor_name: {appt['doctor_name']}")
                else:
                    results.add_fail("Appointment doctor_name", "doctor_name field missing")
                
                # Check for visit_id (can be null if no visit yet)
                if 'visit_id' in appt:
                    results.add_pass(f"Appointment has visit_id field: {appt['visit_id']}")
                else:
                    results.add_fail("Appointment visit_id", "visit_id field missing")
            else:
                results.add_pass("GET /appointments?date=today works (no appointments to check enrichment)")
        else:
            results.add_fail("GET /appointments?date=today", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /appointments?date=today", str(e))
    
    # Test 8.2: GET /appointments?patient_id=ID (no date filter)
    if patient_id:
        print_info("8.2 Testing GET /appointments?patient_id=ID (no date filter)...")
        try:
            resp = session_a.get(f"{BASE_URL}/appointments?patient_id={patient_id}")
            if resp.status_code == 200:
                data = resp.json()
                appointments = data.get('appointments', [])
                if isinstance(appointments, list):
                    results.add_pass(f"GET /appointments?patient_id works without date filter (found {len(appointments)} appointments)")
                    # Verify all appointments belong to the patient
                    if all(a.get('patient_id') == patient_id for a in appointments):
                        results.add_pass("All appointments belong to the specified patient")
                    else:
                        results.add_fail("Appointments patient filter", "Some appointments don't belong to the specified patient")
                else:
                    results.add_fail("GET /appointments?patient_id", f"Expected array, got {type(appointments)}")
            else:
                results.add_fail("GET /appointments?patient_id", f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            results.add_fail("GET /appointments?patient_id", str(e))

# ============================================================================
# MAIN TEST EXECUTION
# ============================================================================

def main():
    print("\n" + "="*80)
    print("DentOS Backend API Test Suite - Phase 2")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print(f"Today's date (env): {today_iso()}")
    print("="*80)
    
    try:
        # PHASE 1 REGRESSION (Quick check - skip if already tested)
        print_info("Running Phase 1 regression tests...")
        
        # Test 1: Auth + Multi-tenant
        session_a, session_b = test_auth_and_multi_tenant()
        
        # Test 2: Onboarding
        test_onboarding(session_a)
        
        # Test 3: Patients + Multi-tenant isolation (CRITICAL)
        patient_id_a = test_patients_multi_tenant(session_a, session_b)
        
        # Test 4: Appointments + Multi-tenant
        if patient_id_a:
            test_appointments_multi_tenant(session_a, session_b, patient_id_a)
        else:
            print_fail("Skipping appointments tests - no patient_id from previous test")
        
        # PHASE 2 NEW TESTS
        print_info("\n\nStarting Phase 2 new endpoint tests...")
        
        # Test 5: Dashboard stats (Phase 2 reshaped)
        test_dashboard_stats_phase2(session_a)
        
        # Test 6: Patient filters + patient_code format
        fresh_patient_id = test_patient_filters(session_a)
        
        # Test 7: Visits full flow (CRITICAL)
        visit_id = test_visits_full_flow(session_a, session_b)
        
        # Test 8: Appointments enriched
        if patient_id_a:
            test_appointments_enriched(session_a, patient_id_a)
        else:
            print_fail("Skipping appointments enriched tests - no patient_id")
        
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

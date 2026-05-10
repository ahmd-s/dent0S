#!/usr/bin/env python3
"""
DentOS Backend API Test Suite
Tests multi-tenant SaaS clinic management system with JWT cookie auth
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://dental-os-3.preview.emergentagent.com/api"

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
# TEST 5: DASHBOARD STATS
# ============================================================================

def test_dashboard_stats(session_a):
    print_test("5. DASHBOARD STATS")
    
    print_info("5.1 Testing GET /dashboard/stats for Clinic A...")
    try:
        resp = session_a.get(f"{BASE_URL}/dashboard/stats")
        if resp.status_code == 200:
            data = resp.json()
            
            # Check all required fields
            required_fields = ['total_patients', 'today_appointments', 'today_list', 'recent_patients', 'monthly_revenue', 'pending_invoices']
            missing = [f for f in required_fields if f not in data]
            
            if not missing:
                results.add_pass("Dashboard stats contains all required fields")
                
                # Verify data types
                if isinstance(data['total_patients'], int) and data['total_patients'] >= 1:
                    results.add_pass(f"total_patients is integer >= 1 (value: {data['total_patients']})")
                else:
                    results.add_fail("Dashboard stats", f"total_patients should be int >= 1, got {data['total_patients']}")
                
                if isinstance(data['today_appointments'], int):
                    results.add_pass(f"today_appointments is integer (value: {data['today_appointments']})")
                else:
                    results.add_fail("Dashboard stats", f"today_appointments should be int, got {data['today_appointments']}")
                
                if isinstance(data['today_list'], list):
                    results.add_pass(f"today_list is array (length: {len(data['today_list'])})")
                else:
                    results.add_fail("Dashboard stats", f"today_list should be array, got {type(data['today_list'])}")
                
                if isinstance(data['recent_patients'], list):
                    results.add_pass(f"recent_patients is array (length: {len(data['recent_patients'])})")
                else:
                    results.add_fail("Dashboard stats", f"recent_patients should be array, got {type(data['recent_patients'])}")
                
                if isinstance(data['monthly_revenue'], (int, float)):
                    results.add_pass(f"monthly_revenue is number (value: {data['monthly_revenue']})")
                else:
                    results.add_fail("Dashboard stats", f"monthly_revenue should be number, got {type(data['monthly_revenue'])}")
                
                if isinstance(data['pending_invoices'], int):
                    results.add_pass(f"pending_invoices is integer (value: {data['pending_invoices']})")
                else:
                    results.add_fail("Dashboard stats", f"pending_invoices should be int, got {type(data['pending_invoices'])}")
            else:
                results.add_fail("Dashboard stats", f"Missing fields: {missing}")
        else:
            results.add_fail("GET /dashboard/stats", f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        results.add_fail("GET /dashboard/stats", str(e))

# ============================================================================
# MAIN TEST EXECUTION
# ============================================================================

def main():
    print("\n" + "="*80)
    print("DentOS Backend API Test Suite")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print(f"Test started at: {datetime.now().isoformat()}")
    print("="*80)
    
    try:
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
        
        # Test 5: Dashboard stats
        test_dashboard_stats(session_a)
        
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

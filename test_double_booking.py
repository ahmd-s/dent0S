#!/usr/bin/env python3
"""
DentOS Double-Booking Protection Test Suite
Tests appointment conflict detection across all scenarios
"""

import requests
import json
import sys
from datetime import datetime, timedelta, date

# Base URL - adjust as needed
BASE_URL = "http://localhost:3000/api"

def today_iso():
    return date.today().isoformat()

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

# Test data
CLINIC_DATA = {
    "full_name": "Dr. Test Doctor",
    "email": f"test.doctor.{datetime.now().timestamp()}@dentalclinic.in",
    "phone": "9876543210",
    "clinic_name": "Test Clinic",
    "password": "password123"
}

def signup_clinic():
    """Create a test clinic and return clinic_id and session cookie"""
    print_test("Creating test clinic")
    response = requests.post(f"{BASE_URL}/auth/signup", json=CLINIC_DATA)
    if response.status_code not in [200, 201]:
        print_fail(f"Signup failed: {response.text}")
        return None, None
    data = response.json()
    clinic_id = data.get('clinic_id')  # This might not be returned, we'll get it from /auth/me
    session_cookie = response.cookies.get('auth')
    print_pass("Clinic created successfully")
    return clinic_id, session_cookie

def get_clinic_id(session_cookie):
    """Get clinic_id from /auth/me"""
    response = requests.get(f"{BASE_URL}/auth/me", cookies={'auth': session_cookie})
    if response.status_code == 200:
        data = response.json()
        return data.get('clinic', {}).get('id')
    return None

def create_doctor(session_cookie, clinic_id):
    """Create a test doctor"""
    print_test("Creating test doctor")
    doctor_data = {
        "full_name": "Dr. John Smith",
        "email": f"dr.smith.{datetime.now().timestamp()}@dentalclinic.in",
        "password": "password123",
        "role": "doctor"
    }
    response = requests.post(f"{BASE_URL}/team", json=doctor_data, cookies={'auth': session_cookie})
    if response.status_code in [200, 201]:
        data = response.json()
        print_pass(f"Doctor created: {data.get('id')}")
        return data.get('id')
    print_fail(f"Doctor creation failed: {response.text}")
    return None

def create_patient(session_cookie):
    """Create a test patient"""
    print_test("Creating test patient")
    patient_data = {
        "name": "Test Patient",
        "phone": "9876543200"
    }
    response = requests.post(f"{BASE_URL}/patients", json=patient_data, cookies={'auth': session_cookie})
    if response.status_code in [200, 201]:
        data = response.json()
        print_pass(f"Patient created: {data.get('id')}")
        return data.get('id')
    print_fail(f"Patient creation failed: {response.text}")
    return None

def book_appointment_receptionist(session_cookie, patient_id, doctor_id, date, time, expected_status=200):
    """Book appointment via receptionist endpoint"""
    appointment_data = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "appointment_date": date,
        "appointment_time": time,
        "appointment_type": "consultation",
        "chief_complaint": "Test complaint"
    }
    response = requests.post(f"{BASE_URL}/appointments", json=appointment_data, cookies={'auth': session_cookie})
    print_info(f"Receptionist booking response: {response.status_code}")
    if response.status_code == expected_status:
        print_pass(f"Receptionist booking returned expected status {expected_status}")
        if response.status_code == 200:
            return response.json().get('id')
        return None
    else:
        print_fail(f"Receptionist booking expected {expected_status}, got {response.status_code}: {response.text}")
        return None

def book_appointment_public(clinic_slug, patient_data, doctor_id, date, time, expected_status=200):
    """Book appointment via public endpoint"""
    booking_data = {
        "name": patient_data["name"],
        "phone": patient_data["phone"],
        "doctor_id": doctor_id,
        "appointment_date": date,
        "appointment_time": time,
        "visitor_type": "new"
    }
    response = requests.post(f"{BASE_URL}/public/clinic/{clinic_slug}/book", json=booking_data)
    print_info(f"Public booking response: {response.status_code}")
    if response.status_code == expected_status:
        print_pass(f"Public booking returned expected status {expected_status}")
        if response.status_code == 200:
            return response.json().get('id')
        return None
    else:
        print_fail(f"Public booking expected {expected_status}, got {response.status_code}: {response.text}")
        return None

def update_appointment_status(session_cookie, appointment_id, status):
    """Update appointment status"""
    response = requests.put(f"{BASE_URL}/appointments/{appointment_id}", 
                          json={"status": status}, 
                          cookies={'auth': session_cookie})
    if response.status_code == 200:
        print_pass(f"Appointment status updated to {status}")
        return True
    print_fail(f"Failed to update appointment status: {response.text}")
    return False

def get_clinic_slug(session_cookie):
    """Get clinic slug from clinic data"""
    response = requests.get(f"{BASE_URL}/auth/me", cookies={'auth': session_cookie})
    if response.status_code == 200:
        data = response.json()
        return data.get('clinic', {}).get('slug')
    return None

def main():
    print("\n" + "="*80)
    print("DENTOS DOUBLE-BOOKING PROTECTION TEST SUITE")
    print("="*80)
    
    # Setup
    clinic_id, session_cookie = signup_clinic()
    if not session_cookie:
        print_fail("Failed to setup test clinic")
        return
    
    clinic_id = get_clinic_id(session_cookie)
    clinic_slug = get_clinic_slug(session_cookie)
    
    if not clinic_id or not clinic_slug:
        print_fail("Failed to get clinic details")
        return
    
    doctor1_id = create_doctor(session_cookie, clinic_id)
    doctor2_id = create_doctor(session_cookie, clinic_id)
    
    if not doctor1_id or not doctor2_id:
        print_fail("Failed to create doctors")
        return
    
    patient1_id = create_patient(session_cookie)
    patient2_id = create_patient(session_cookie)
    
    if not patient1_id or not patient2_id:
        print_fail("Failed to create patients")
        return
    
    test_date = today_iso()
    test_time = "10:00 AM"
    
    # Test 1: Receptionist books slot
    print_test("Test 1: Receptionist books slot")
    apt1 = book_appointment_receptionist(session_cookie, patient1_id, doctor1_id, test_date, test_time, 200)
    if apt1:
        print_pass("Test 1 PASSED: Receptionist successfully booked slot")
    else:
        print_fail("Test 1 FAILED: Receptionist could not book slot")
        return
    
    # Test 2: Second receptionist tries same slot (should fail with 409)
    print_test("Test 2: Second receptionist tries same slot (should fail with 409)")
    apt2 = book_appointment_receptionist(session_cookie, patient2_id, doctor1_id, test_date, test_time, 409)
    if apt2 is None and response.status_code == 409:
        print_pass("Test 2 PASSED: Second receptionist blocked with 409")
    else:
        print_fail("Test 2 FAILED: Second receptionist was not blocked")
    
    # Test 3: Public booking tries same slot (should fail with 409)
    print_test("Test 3: Public booking tries same slot (should fail with 409)")
    public_patient = {"name": "Public Patient", "phone": "9876543201"}
    apt3 = book_appointment_public(clinic_slug, public_patient, doctor1_id, test_date, test_time, 409)
    if apt3 is None:
        print_pass("Test 3 PASSED: Public booking blocked with 409")
    else:
        print_fail("Test 3 FAILED: Public booking was not blocked")
    
    # Test 4: Different doctor same time (should succeed)
    print_test("Test 4: Different doctor same time (should succeed)")
    apt4 = book_appointment_receptionist(session_cookie, patient2_id, doctor2_id, test_date, test_time, 200)
    if apt4:
        print_pass("Test 4 PASSED: Different doctor can book same time")
    else:
        print_fail("Test 4 FAILED: Different doctor blocked incorrectly")
    
    # Test 5: Cancelled appointment slot reuse (should succeed)
    print_test("Test 5: Cancelled appointment slot reuse (should succeed)")
    if update_appointment_status(session_cookie, apt1, 'cancelled'):
        apt5 = book_appointment_receptionist(session_cookie, patient1_id, doctor1_id, test_date, test_time, 200)
        if apt5:
            print_pass("Test 5 PASSED: Cancelled slot can be reused")
            apt1 = apt5  # Update reference for subsequent tests
        else:
            print_fail("Test 5 FAILED: Cancelled slot could not be reused")
    else:
        print_fail("Test 5 FAILED: Could not cancel appointment")
    
    # Test 6: No-show appointment slot reuse (should succeed)
    print_test("Test 6: No-show appointment slot reuse (should succeed)")
    if update_appointment_status(session_cookie, apt1, 'no_show'):
        apt6 = book_appointment_receptionist(session_cookie, patient2_id, doctor1_id, test_date, test_time, 200)
        if apt6:
            print_pass("Test 6 PASSED: No-show slot can be reused")
            apt1 = apt6  # Update reference for subsequent tests
        else:
            print_fail("Test 6 FAILED: No-show slot could not be reused")
    else:
        print_fail("Test 6 FAILED: Could not mark appointment as no-show")
    
    # Test 7: Completed appointment slot reuse (should succeed)
    print_test("Test 7: Completed appointment slot reuse (should succeed)")
    if update_appointment_status(session_cookie, apt1, 'completed'):
        apt7 = book_appointment_receptionist(session_cookie, patient1_id, doctor1_id, test_date, test_time, 200)
        if apt7:
            print_pass("Test 7 PASSED: Completed slot can be reused")
            apt1 = apt7  # Update reference for subsequent tests
        else:
            print_fail("Test 7 FAILED: Completed slot could not be reused")
    else:
        print_fail("Test 7 FAILED: Could not mark appointment as completed")
    
    # Test 8: Arrived status should block (should fail with 409)
    print_test("Test 8: Arrived status should block (should fail with 409)")
    if update_appointment_status(session_cookie, apt1, 'arrived'):
        apt8 = book_appointment_receptionist(session_cookie, patient2_id, doctor1_id, test_date, test_time, 409)
        if apt8 is None:
            print_pass("Test 8 PASSED: Arrived appointment blocks slot")
        else:
            print_fail("Test 8 FAILED: Arrived appointment did not block slot")
    else:
        print_fail("Test 8 FAILED: Could not mark appointment as arrived")
    
    # Test 9: In-progress status should block (should fail with 409)
    print_test("Test 9: In-progress status should block (should fail with 409)")
    if update_appointment_status(session_cookie, apt1, 'in_progress'):
        apt9 = book_appointment_receptionist(session_cookie, patient1_id, doctor1_id, test_date, test_time, 409)
        if apt9 is None:
            print_pass("Test 9 PASSED: In-progress appointment blocks slot")
        else:
            print_fail("Test 9 FAILED: In-progress appointment did not block slot")
    else:
        print_fail("Test 9 FAILED: Could not mark appointment as in-progress")
    
    # Test 10: Different clinic same time (would require second clinic setup)
    print_test("Test 10: Different clinic same time (skipped - requires multi-clinic setup)")
    print_info("This test would require creating a second clinic and verifying isolation")
    
    print("\n" + "="*80)
    print("TEST SUITE COMPLETED")
    print("="*80)

if __name__ == "__main__":
    main()

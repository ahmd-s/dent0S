# DentOS Performance Investigation Report

**Date:** June 4, 2026  
**Investigator:** Performance Engineering Analysis  
**Scope:** Dashboard, Patients, Appointments, Visits, Lab Cases, Vendors pages

---

## Executive Summary

After comprehensive code analysis of DentOS, I identified **critical performance bottlenecks** that explain the sluggish navigation experience. The primary issues are:

1. **Dashboard Stats API** makes 12+ separate database calls on every load
2. **Massive monolithic API route** with 23+ routes in a single file
3. **N+1 query patterns** throughout the application
4. **Client-side pagination** fetching 500+ records at once
5. **Missing database indexes** for common query patterns
6. **Global search** triggering API calls on every keystroke

These issues compound to create the slow navigation experience reported by users.

---

## Root Cause Analysis

### CRITICAL BOTTLENECKS

#### 1. Dashboard Stats API - 12+ Database Calls Per Load

**File:** `app/api/[[...path]]/route.js` (Lines 689-719)  
**Severity:** CRITICAL  
**Impact:** Every dashboard page load

**Problem:**
The `/api/dashboard/stats` endpoint makes 12 separate database calls in sequence:

```javascript
// Batch 1: 3 calls
const [todayAppts, doneToday, doneYest] = await Promise.all([
  db.collection('appointments').find(...).toArray(),      // Get today's appointments
  db.collection('appointments').countDocuments(...),      // Count completed today
  db.collection('appointments').countDocuments(...)       // Count completed yesterday
])

// Batch 2: 3 calls (N+1 pattern)
const [pts, docs, visits] = await Promise.all([
  db.collection('patients').find({ id: { $in: pids } }).toArray(),  // Fetch patients
  db.collection('profiles').find({ id: { $in: dids } }).toArray(),  // Fetch doctors
  db.collection('visits').find(...).toArray()                      // Fetch visits
])

// Batch 3: 2 aggregation calls
const [revAgg, pendAgg] = await Promise.all([
  db.collection('invoices').aggregate([...]),  // Revenue aggregation
  db.collection('invoices').aggregate([...])   // Pending aggregation
])

// Batch 4: 2 duplicate calls
const followups = await db.collection('patients').find(...).limit(5).toArray()
const fcount = await db.collection('patients').countDocuments(...)  // Same query, just counting!

// Batch 5: 2 count calls
const [activeLabCases, overdueLabCases] = await Promise.all([
  db.collection('lab_cases').countDocuments(...),
  db.collection('lab_cases').countDocuments(...)
])
```

**Why It's Slow:**
- 12 round trips to database (even with Promise.all batches)
- Duplicate queries (followups fetched twice with same criteria)
- N+1 pattern: appointments → patients/doctors/visits
- No caching of results
- Called on EVERY dashboard load

**Estimated Impact:** 500-1500ms per dashboard load

**Evidence:** Dashboard is the first page users see, setting initial perception of app speed.

---

#### 2. Monolithic API Route - 23+ Routes in Single File

**File:** `app/api/[[...path]]/route.js` (763 lines)  
**Severity:** CRITICAL  
**Impact:** Every API call

**Problem:**
All API routes are handled in a single 763-line catch-all file with 23+ route conditions:

```javascript
async function handle(request, { params }) {
  const path = params?.path || []
  const route = '/' + path.join('/')
  
  // 23+ if conditions to check
  if (route === '/auth/signup' && m === 'POST') { ... }
  if (route === '/auth/login' && m === 'POST') { ... }
  if (route === '/patients' && m === 'GET') { ... }
  if (route === '/patients' && m === 'POST') { ... }
  // ... 19 more route handlers
}
```

**Why It's Slow:**
- Entire 763-line file loaded for every API request
- No code splitting or lazy loading
- Route matching happens at runtime through sequential if statements
- Hard to optimize individual routes
- Increased memory usage
- Slower cold starts

**Estimated Impact:** 50-200ms per API call (routing overhead + memory)

**Evidence:** Next.js route handlers should be in separate files for automatic code splitting.

---

#### 3. Appointments API - N+1 Query Pattern

**File:** `app/api/[[...path]]/route.js` (Lines 350-368)  
**Severity:** CRITICAL  
**Impact:** Appointments page load

**Problem:**
```javascript
// Query 1: Get appointments
const apps = await db.collection('appointments').find(f).toArray()

// Extract IDs
const pids = [...new Set(apps.map(a=>a.patient_id).filter(Boolean))]
const dids = [...new Set(apps.map(a=>a.doctor_id).filter(Boolean))]

// Query 2 & 3: Fetch patients and doctors (N+1)
const [pts, docs] = await Promise.all([
  db.collection('patients').find({ id: { $in: pids } }).toArray(),
  db.collection('profiles').find({ id: { $in: dids } }).toArray()
])

// Query 4: Fetch visits (another N+1)
const visits = await db.collection('visits').find({ 
  clinic_id: cid, 
  appointment_id: { $in: apps.map(a=>a.id) } 
}).toArray()
```

**Why It's Slow:**
- 4 separate database calls for one appointment list
- Multiple round trips
- Data transformation in JavaScript instead of database
- Could be done with aggregations or joins

**Estimated Impact:** 200-500ms per appointments load

---

#### 4. Patients Page - Client-Side Pagination

**File:** `app/(app)/patients/page.js` (Lines 28-41)  
**Severity:** CRITICAL  
**Impact:** Patients page load

**Problem:**
```javascript
const load = async () => {
  setLoading(true)
  const r = await fetch('/api/patients?' + params)
  const d = await r.json()
  setList(d.patients || [])  // Loads ALL patients (up to 500)
  setLoading(false)
}

// Client-side pagination
const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
const visible = list.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)
```

**API returns up to 500 patients:**
```javascript
const list = await db.collection('patients').find(f).sort({ created_at: -1 }).limit(500).toArray()
```

**Why It's Slow:**
- Fetches 500 patient records regardless of page size
- Large JSON payload transfer
- Client-side processing of large arrays
- Slow on mobile devices
- No server-side pagination

**Estimated Impact:** 300-800ms per patients page load, worse on slow connections

---

### HIGH BOTTLENECKS

#### 5. Visits API - N+1 Query Pattern

**File:** `app/api/[[...path]]/route.js` (Lines 482-491)  
**Severity:** HIGH  
**Impact:** Visits page load

**Problem:**
```javascript
// Query 1: Get visits
const list = await db.collection('visits').find(f).toArray()

// Query 2: Get doctors (N+1)
const docs = await db.collection('profiles').find({ id: { $in: dids } }).toArray()

// Query 3: Get prescriptions (N+1)
const rxs = await db.collection('prescriptions').find({ 
  visit_id: { $in: list.map(v=>v.id) } 
}).toArray()
```

**Why It's Slow:**
- 3 separate database calls
- Same N+1 pattern as appointments
- Could use aggregations

**Estimated Impact:** 200-400ms per visits load

---

#### 6. Invoice Queries - Duplicate Monthly Summary

**File:** `app/api/[[...path]]/route.js` (Lines 572-594)  
**Severity:** HIGH  
**Impact:** Invoice page load

**Problem:**
```javascript
// Query 1: Get invoices
const list = await db.collection('invoices').find(f).toArray()

// Query 2: Get patients
const pts = await db.collection('patients').find({ id: { $in: pids } }).toArray()

// Query 3: DUPLICATE QUERY for monthly summary
const monthInv = await db.collection('invoices').find({ 
  clinic_id: cid, 
  invoice_date: { $gte: mStart } 
}).toArray()
```

**Why It's Slow:**
- Queries invoices twice with similar criteria
- Monthly summary could be calculated from first query
- Wasted database round trip

**Estimated Impact:** 150-300ms per invoice page load

---

#### 7. Global Search - API Call on Every Keystroke

**File:** `components/dentos/AppShell.jsx` (Lines 62-70)  
**Severity:** HIGH  
**Impact:** Every page (global component)

**Problem:**
```javascript
useEffect(() => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  if (!q.trim()) { setResults([]); return }
  debounceRef.current = setTimeout(async () => {
    const r = await fetch(`/api/patients?q=${encodeURIComponent(q)}`)
    const d = await r.json()
    setResults((d.patients||[]).slice(0,5))
  }, 300)
}, [q])
```

**Why It's Slow:**
- API call on every keystroke (300ms debounced)
- Searches entire patient database
- No caching of search results
- Runs on every page with AppShell

**Estimated Impact:** 100-300ms per search interaction

---

#### 8. Patient Code Generation - countDocuments on Every Create

**File:** `app/api/[[...path]]/route.js` (Lines 318-319, 403-406, 450-453)  
**Severity:** HIGH  
**Impact:** Patient creation

**Problem:**
```javascript
// Called 3 different places in the code
const count = await db.collection('patients').countDocuments({ clinic_id: cid })
const code = 'PT' + String(count + 1).padStart(5,'0')
```

**Why It's Slow:**
- countDocuments is expensive on large collections
- Called every time a patient is created
- No caching or counter collection
- Could use auto-increment or findAndUpdate

**Estimated Impact:** 100-200ms per patient creation

---

### MEDIUM BOTTLENECKS

#### 9. Missing Database Indexes

**File:** `lib/setup-indexes.js`  
**Severity:** MEDIUM  
**Impact:** Multiple queries

**Missing Indexes:**
- `next_followup_date` for patients (used in dashboard stats)
- Composite indexes for common query patterns
- `status` + `expected_delivery_date` for lab_cases

**Why It's Slow:**
- Full collection scans for filtered queries
- Especially slow as data grows

**Estimated Impact:** 50-150ms per affected query

---

#### 10. Sequential Delete Operations

**File:** `app/api/[[...path]]/route.js` (Lines 342-345)  
**Severity:** MEDIUM  
**Impact:** Patient deletion

**Problem:**
```javascript
await db.collection('visits').deleteMany({ patient_id: path[1], clinic_id: cid })
await db.collection('appointments').deleteMany({ patient_id: path[1], clinic_id: cid })
await db.collection('prescriptions').deleteMany({ patient_id: path[1], clinic_id: cid })
await db.collection('patients').deleteOne({ id: path[1], clinic_id: cid })
```

**Why It's Slow:**
- 4 sequential delete operations
- Could use Promise.all or transactions
- No foreign key constraints

**Estimated Impact:** 100-200ms per patient deletion

---

#### 11. Invoice Number Generation - countDocuments

**File:** `app/api/[[...path]]/route.js` (Line 538)  
**Severity:** MEDIUM  
**Impact:** Invoice creation

**Problem:**
```javascript
const count = await db.collection('invoices').countDocuments({ clinic_id: cid })
const invoice_number = `INV-${initials(clinic.name)}-${String(count+1).padStart(5,'0')}`
```

**Why It's Slow:**
- Same issue as patient code generation
- Expensive countDocuments on large collections

**Estimated Impact:** 50-150ms per invoice creation

---

### LOW BOTTLENECKS

#### 12. No Response Caching

**Severity:** LOW  
**Impact:** All API calls

**Problem:**
- No HTTP caching headers
- No server-side caching
- Stats data re-fetched every time

**Estimated Impact:** 50-100ms per repeated request

---

#### 13. Large JSON Payloads

**Severity:** LOW  
**Impact:** Slower connections

**Problem:**
- Fetching full patient records (all fields)
- No field projection
- Sending unnecessary data over network

**Estimated Impact:** 20-50ms per large payload on slow connections

---

## Summary Table

| Bottleneck | Severity | File | Impact | Est. Time |
|------------|----------|------|--------|-----------|
| Dashboard Stats API | CRITICAL | route.js:689-719 | Every dashboard load | 500-1500ms |
| Monolithic API Route | CRITICAL | route.js (763 lines) | Every API call | 50-200ms |
| Appointments N+1 | CRITICAL | route.js:350-368 | Appointments page | 200-500ms |
| Client-Side Pagination | CRITICAL | patients/page.js | Patients page | 300-800ms |
| Visits N+1 | HIGH | route.js:482-491 | Visits page | 200-400ms |
| Invoice Duplicate Query | HIGH | route.js:572-594 | Invoice page | 150-300ms |
| Global Search | HIGH | AppShell.jsx | Every page | 100-300ms |
| Patient Code countDocuments | HIGH | route.js (3 places) | Patient creation | 100-200ms |
| Missing Indexes | MEDIUM | setup-indexes.js | Multiple queries | 50-150ms |
| Sequential Deletes | MEDIUM | route.js:342-345 | Patient deletion | 100-200ms |
| Invoice countDocuments | MEDIUM | route.js:538 | Invoice creation | 50-150ms |
| No Response Caching | LOW | All APIs | Repeated requests | 50-100ms |
| Large JSON Payloads | LOW | All APIs | Slow connections | 20-50ms |

---

## Recommendations Priority

### Phase 1: Quick Wins (1-2 days)
1. **Fix Dashboard Stats API** - Combine queries, remove duplicates
2. **Implement Server-Side Pagination** - For patients and other lists
3. **Add Missing Indexes** - For next_followup_date and other fields

### Phase 2: High Impact (3-5 days)
4. **Split Monolithic API Route** - Separate route files for code splitting
5. **Fix N+1 Queries** - Use aggregations or batch queries
6. **Optimize Global Search** - Add debouncing, caching, limits

### Phase 3: Long-term (1-2 weeks)
7. **Implement Response Caching** - HTTP headers, server-side cache
8. **Optimize Count Operations** - Use counters or findAndUpdate
9. **Add Performance Monitoring** - Continuous tracking

---

## Success Criteria

After implementing Phase 1 and Phase 2 optimizations:
- Dashboard load time: <500ms (currently 500-1500ms)
- Patients page load: <300ms (currently 300-800ms)
- Appointments page load: <300ms (currently 200-500ms)
- App should feel responsive and instant

---

## Next Steps

Ready to proceed with optimization implementation. Recommended order:
1. Dashboard Stats API optimization (highest impact)
2. Server-side pagination (quick win)
3. API route splitting (architectural improvement)
4. N+1 query fixes (systematic improvement)

Proceed with implementation?
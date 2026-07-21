# DentOS — Phases.md
Single source of truth for execution order and technical detail on production-readiness work. (Replaces the earlier separate DENTOS_PRIORITY_PLAN.md — that file is now retired, everything from it lives here.) Do not skip ahead to a later phase while an earlier one has open items, unless explicitly told to. Each phase should reach a clear "done" state before moving on.

---

## Phase 1 — Authentication & Core Login Hardening

**Goal:** Auth is trustworthy end-to-end before anything else matters.

Confirmed working:
- Login/JWT/bcrypt flow exists (`lib/auth.js`), cookie-based session (`dentos_token`), 30-day expiry.
- Middleware (`middleware.js`) redirects unauthenticated users to `/login` on all protected prefixes.
- `app/api/auth/login/route.js` correctly checks `is_active` + verifies password hash and returns 401 on bad credentials.

To fix:
1. **`JWT_SECRET` silent fallback** (`lib/auth.js` line 5) — falls back to `'dev-secret'` if env var missing. Fix: fail loudly (throw on boot) if `JWT_SECRET` is not set in production.
2. **Cookie `secure: false` hardcoded** (`lib/auth.js` line 26) — should be `secure: process.env.NODE_ENV === 'production'` (or always true once on HTTPS).
3. **Password reset flow — does not exist.** `app/login/page.js` line 70: "Forgot password?" points to `href="#"` — dead link, no backend route. Build: request-reset endpoint (generate token, email link via Resend, already integrated), reset-confirm endpoint.
4. **Broken "already logged in" check** (`app/login/page.js` line 16): `localStorage.getItem('token') || document.cookie.includes('token')` — checks a `token` key/substring that the app never sets (real cookie is `dentos_token`, httpOnly, unreadable via JS). Dead/misleading code — possible source of confusing behavior. Replace with a real check (e.g., lightweight `/api/auth/me` call).
5. **No Google/social login** — not built. New feature.
6. **Logout** — not yet verified whether cookie is cleared server + client side.
7. **"Logs in with nonexistent email" report** — could NOT reproduce from static code (login route correctly rejects bad credentials). Needs a live re-test: exact email used, exact behavior seen (error shown? real or empty dashboard data?) before concluding this is fixed or still open.

Acceptance bar: pen-test-style pass — try logging in with expired/tampered/missing/nonexistent-email credentials, confirm cookie is HTTPOnly+Secure in prod, confirm no environment can boot with a default secret, confirm password reset and Google login both work end to end.

---

## Phase 2 — Dashboard / Live-Data Refresh

**Goal:** New bookings (especially via the public online-booking portal) appear in staff's queue without a manual page reload.

Confirmed root cause: `app/(app)/dashboard/page.js` line 42 — `useEffect(() => { load() }, [])` fetches `/api/dashboard/stats` exactly once, on mount. No interval, no polling, no websocket/SSE, no revalidate-on-focus. Anything created elsewhere is invisible until manual browser refresh.

Fix options (simplest → most robust):
1. Polling every N seconds — simple, small delay, some wasted requests.
2. Revalidate on window focus/visibility — cheap, misses same-screen real-time case.
3. **Recommended now: combine 1+2** (polling ~20–30s + refetch on focus) — low risk, fast, solves the reported problem.
4. Real-time push (WebSocket/SSE/Mongo change streams) — correct long-term answer, real new infrastructure, defer until later phases are stable.

Also check: Appointments, Lab Cases, and Billing list/queue views likely have the same single-fetch-on-mount issue — verify each and apply the same fix pattern.

---

## Phase 3 — Unauthenticated API Endpoints (Cost/Abuse Exposure)

**Goal:** Stop unauthenticated consumption of paid API quotas.

Confirmed vulnerable:
1. **`app/api/ai/analyze-xray/route.js`** — zero auth check. Also fetches an arbitrary client-supplied `imageUrl` server-side with no host/scheme restriction (SSRF vector on top of quota abuse). Fix: add auth check + restrict `imageUrl` to your own Cloudinary domain.
2. **`app/api/voice/transcribe/route.js`** — zero auth check, directly proxies to Groq using your API key. Fix: add auth check.
3. **`app/api/seed-master-catalog/route.js`** — zero auth, unauthenticated write endpoint (lower risk — idempotent, no patient data — but should require admin auth or be removed after initial seeding).

Verified NOT a gap (documented so it isn't re-flagged):
- `app/api/appointments/today-by-doctor/route.js` — uses a separate internal service API key (`WHATSAPP_SERVICE_API_KEY`), correct pattern for service-to-service calls. Confirm this key is never shipped to any client bundle.

Acceptance bar: every route touching Gemini/Groq requires a valid logged-in session first. Bonus: basic rate-limiting per user/clinic on these two routes even post-fix, since authenticated abuse (one clinic hammering the endpoint) could still run up costs.

---

## Phase 4 — Doctor-Level Access Control (within a clinic)

**Goal:** Dr. A cannot see Dr. B's patients/stats/revenue when they share a clinic.

Confirmed gap: `app/api/dashboard/stats/route.js` and the RBAC model (`lib/rbac.js`) only scope by `clinic_id` — no `doctor_id`/assigned-doctor dimension exists anywhere.

**Blocked on a design decision — resolve before implementation:**
- Does "Dr. A can't see Dr. B's stats" mean Dr. A also can't see Dr. B's **patients** at all, or just can't see Dr. B's **revenue/performance numbers**?
- If a patient has been seen by both doctors, does each doctor see only their own visit history with that patient, or the full shared history?
- Admin/owner still sees everything across all doctors — assumed yes, needs confirming.

Once resolved: add `doctor_id`/assigned-doctor dimension to `lib/rbac.js` and to `dashboard/stats` and any other route currently scoping by `clinic_id` alone where doctor-level separation matters. Scope of this work depends entirely on the answer above — could be a small dashboard-query change or a large cross-cutting change touching patients/visits/appointments/billing.

---

## Phase 5 — Multi-Clinic Isolation (verification pass)

**Goal:** Clinic A can never see Clinic B's data, under any circumstance.

Good news: better shape than expected. Sampled routes (`patients`, `patients/[id]`, `dashboard/stats`) all correctly derive `clinic_id` server-side from the authenticated profile (never trust client input) and include it in every query.

Remaining work is **verification, not construction**:
1. Sweep all remaining API routes (~75 not yet checked) with the same method: grep for `.collection(` calls missing `clinic_id`, then manually confirm each hit.
2. Specifically re-check the catch-all route `app/api/[[...path]]/route.js` — catch-all routes are a common place for scoping logic to get missed or duplicated inconsistently.
3. Write one automated test (two test clinics; assert clinic A's session can never fetch clinic B's records via any endpoint) as a permanent regression guard.

---

## Phase 6 — Billing, Subscription Lifecycle, Super Admin Panel

**Goal:** The business model is actually enforceable in software.

Needs building (mostly new, not audit):
1. **Super admin panel** — Connec8-level role above clinic admin, for support/ops visibility across all clinics. Not designed yet — needs a scoping conversation (what can super admin see/do; read-only vs. can act on a clinic's behalf).
2. **Subscription state machine**: Active → Grace period (15 days) → Feature-locked → reactivation on payment. Needs a `subscription_status` + `plan_expiry_date` field on the clinic record, a scheduled job to transition states, and checks that block relevant actions once locked — **while always allowing read access to existing patient clinical records during lockout** (deliberate ethical/legal decision — only new bookings/invoicing should be blocked).
3. **Razorpay auto-pay** — confirm current integration ("alive but not useful," per stakeholder) actually supports recurring billing, not just one-off payments.
4. **Per-branch billing** for multi-clinic accounts — not yet designed.
5. Exact annual price still needs reconciling: ₹9,999 vs ₹10,000 has been stated both ways.

This phase has the most genuinely new design work — slow down and spec the subscription state machine properly before Cursor implementation.

---

## Phase 7 — Remaining Original P0 Checklist Items

Everything from the original checklist not covered above, audited the same evidence-based way once Phases 1–6 are stable:
Patients module completion (visit history/documents), Appointments (booking/queue/online booking), Billing (invoice edit/print, pending amounts), Invoice branding, Patient communication (WhatsApp invoice share), Lab workflow automation, Inventory-linked-to-treatment, Clinic branding (logo upload), Template sorting, Dashboard, Follow-up automation, Notifications, S3 file storage, performance fixes (Mongo connection caching, billing search debounce, parallel queries), cloud readiness (domain/SSL/env vars/backups).

---

## Phase 8 — Multi-Role RBAC, Doctor Scoping & Visit Completion

**Goal:** Replace single `profile.role` with combinable `roles[]`, union-based permissions, doctor-level patient scoping, visit completion workflow, consultation fees, and clinic-wide patient codes.

### Permission matrix (union across roles)

| Resource | Admin | Doctor | Receptionist |
|----------|-------|--------|--------------|
| Patients | full | full (scoped when not admin) | full (all doctors); clinical fields read-only when receptionist-only |
| Visits | full | full (scoped) | clinical read-only |
| Appointments | full | scoped | full (all doctors) |
| Billing | full | read-only | full |
| Inventory / Lab | full | full | full |
| Staff / Settings | full | no | no |

**Route denials:** only `/settings` blocked for doctor and receptionist (admin always allowed via union).

**Doctor scoping:** relationship-based — doctor sees patients/appointments/visits where `doctor_id` matches; bypassed when profile also has `admin`. Receptionist and admin see all clinic data.

**Multi-role:** Admin combinable with doctor/receptionist (≥1 role required, no mutual exclusivity).

### Visit completion workflow

Clinical save → Inventory (skip / done / assign) → Invoice (done / assign) → `completed` when both steps resolved. Assigned steps surface as receptionist pending tasks on dashboard.

### Other Phase 8 deliverables

- `consultation_fee` on doctor profiles; auto first invoice line on visit (editable per invoice)
- `clinics.next_patient_seq` — one shared PT counter per clinic
- Settings Team: multi-select role checkboxes
- Sidebar: union of modules across roles
- Doctor dashboard: booking-queue visibility toggle (any profile with `doctor` role; localStorage)

### Test plan

**A. Roles migration** — Run `scripts/migrate-profile-roles.js`; login JWT includes `roles[]`; `/api/auth/me` lazy-migrates on read.

**B. Receptionist clinical read-only** — Sees visit history and clinical fields; cannot edit visit clinical data or patient allergies/history.

**C. Doctor scoping** — Doctor A cannot list Doctor B's patients/appointments/visits; admin+doctor sees all.

**D. Multi-role team** — Assign `admin+doctor`; nav shows settings + clinical modules; queue toggle visible.

**E. Visit workflow** — Save clinical → inventory skip/done/assign → invoice done/assign → visit completes; receptionist sees pending tasks.

**F. Consultation fee & patient code** — Doctor fee auto-fills invoice line; `nextPatientCode` increments clinic-wide.

**G. Queue toggle** — Doctor can hide/show today's booking queue; preference persists in localStorage.

---

## How We Work Through This
For each phase: verify remaining unknowns in code → resolve any open design questions together → implement in Cursor → review the diff/result → mark done in Memory.md → move to next phase. Don't advance to the next phase until the current one has a clear "done" state, even if that means a phase takes a few passes.

Before marking anything done: re-verify in code, not from memory of having fixed it. Update Memory.md with real, current status at the end of every work session.
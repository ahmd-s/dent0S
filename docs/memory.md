# DentOS — Memory.md
Living document. Update this at the end of every work session so a new chat/AI tool can pick up instantly without re-reading the whole codebase or guessing at status. Keep entries short and factual: what changed, what's verified, what's still open.

---

## How to Use This File
- Add a new dated entry at the top for each session.
- Mark items **Done / Partial / Blocked / Unknown** — never just "worked on it."
- If a design question was resolved, record the actual decision here so it doesn't get re-litigated.
- If you fixed something, note how it was verified (not just "fixed").

---

## Baseline Snapshot — [DATE OF FIRST CURSOR SESSION — fill in]

### Confirmed working (verified in code, not assumed)
- Login/JWT/bcrypt flow, httpOnly cookie session.
- Middleware route-level RBAC gating (`middleware.js` + `lib/rbac.js`).
- API-level permission checks on sampled routes (`patients`, `patients/[id]`).
- Multi-clinic isolation on sampled routes — `clinic_id` always server-derived, never client-trusted. (Only `patients` + `dashboard/stats` fully verified so far — rest of the ~81 routes still need the same sweep.)
- Consent-signing flow (token-based, expiry-checked, correctly scoped without needing `clinic_id`).
- Voice transcription + AI clinical summary features — functionally good, positive user feedback (auth/security issue on the transcribe endpoint is separate, see below).

### Confirmed gaps (verified, not guessed)
- No doctor-to-doctor scoping anywhere — multi-doctor clinics currently show all doctors' data to each other. Design decision not yet made (see Open Questions).
- `analyze-xray` and `voice/transcribe` API routes have zero auth — cost-abuse + SSRF risk.
- `seed-master-catalog` route has zero auth (lower risk, idempotent, no patient data).
- `JWT_SECRET` silent fallback to a dev default if env var unset.
- Auth cookie hardcodes `secure: false`.
- CORS defaults wide open (`*` + credentials) if `CORS_ORIGINS` unset.
- Password reset is a dead link — no backend flow exists.
- No Google/social login.
- Dashboard fetches data once on mount only — no polling/revalidation, so new bookings don't appear without a manual browser refresh. Likely affects other queue views too (unverified which ones exactly).
- "Logs in with nonexistent email" — reported by stakeholder, could NOT reproduce from static code (login route correctly checks `is_active` + password hash). Found a related but distinct bug: broken "already logged in" check in `app/login/page.js` checking a cookie/key that doesn't exist. Needs live re-test to confirm/deny the original report.
- Razorpay integration exists but is "not as useful as it should be" per stakeholder — recurring/auto-pay not yet confirmed functional.
- Super Admin (Connec8-level, cross-clinic) role does not exist yet.
- Subscription lockout state machine does not exist yet.

### Open design questions (need a decision before implementation, not a code fix)
1. Doctor-scoping exact rule: does it mean Dr. A can't see Dr. B's patients at all, or just not stats/revenue? What about a patient both doctors have treated? (Admin sees everything regardless — assumed confirmed.)
2. Exact annual price: ₹9,999 or ₹10,000 — stated both at different points, never reconciled.
3. Super Admin panel scope: what exactly can it see/do across clinics.

### Decisions already made (don't re-litigate these)
- No stack migration during this work (stay on Next.js + MongoDB + JS/JSX).
- Cloud pricing fixed: ₹999/month or ~₹9,999–10,000/year (see open question #2 above for exact figure). No free trial.
- Subscription lockout must never block viewing of existing patient clinical records — only new actions.
- Multi-branch clinics get separate billing per branch.
- No GST logic — clinic is not GST-registered.
- Solo-clinic mode (no receptionist) must let the doctor perform the full workflow themselves.

---

## Session Log
(Add new entries above this line as work happens — newest at top.)

### [Template for next entry]
**Date:**
**Phase worked on:**
**Changed:**
**Verified how:**
**Still open:**
**New decisions made this session:**
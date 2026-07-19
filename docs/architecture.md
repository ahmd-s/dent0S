# DentOS — Architecture.md

## Status of This Document
This describes the **current, real, running codebase** (verified against github.com/ahmd-s/dent0S), not the future/planned architecture. A separate future-state migration (NestJS/PostgreSQL/Prisma/Redis/AWS) exists only in strategy documents and is explicitly NOT part of current work. Do not blend the two.

## Stack (current, verified)
- **Framework:** Next.js 14.2.3, App Router, JavaScript/JSX (no TypeScript)
- **UI:** React 18, Tailwind CSS 3.4 + CSS variables, shadcn/ui ("new-york" style, Radix primitives), Lucide icons, next-themes
- **Forms/Tables/Charts:** React Hook Form + Zod, TanStack React Table, Recharts
- **Database:** MongoDB, native `mongodb` driver v6.6 — no ORM
- **Auth:** JWT (`jsonwebtoken`) + bcryptjs, httpOnly cookie `dentos_token`, 30-day expiry
- **Authorization:** Custom RBAC (`lib/rbac.js`) + Next.js `middleware.js` for route gating
- **File storage:** Cloudinary (folder pattern `dentos/{clinic_id}/{patientId}`)
- **External services:** Razorpay (billing), Resend (emails), Groq (voice transcription + note extraction), Google Gemini (X-ray analysis), custom WhatsApp HTTP service, Microsoft Clarity (analytics)
- **Package manager:** Yarn 1.22
- **Deployment:** Vercel-style (referenced `vercel.app` URLs seen in lab-portal links) / Emergent base image referenced in earlier docs — verify actual current host before making deployment assumptions.

## Multi-Tenancy Model (verified pattern — follow this exactly for any new code)
Every clinic-scoped collection includes a `clinic_id` field. The correct, verified-safe pattern used throughout the codebase:

```js
async function requireUser() {
  const t = getCurrentUser()        // reads + verifies JWT from httpOnly cookie
  if (!t) return null
  const profile = await db.collection('profiles').findOne({ id: t.uid })
  const clinic = await db.collection('clinics').findOne({ id: profile.clinic_id })
  return { profile, clinic, db }
}
```

`clinic_id` is **always derived server-side from the authenticated user's profile** — never trust a `clinic_id` passed in the request body/query/params. Every query (read, update, delete) must include `clinic_id: cid` in its filter. This pattern was verified correct in `app/api/patients/route.js` and `app/api/patients/[id]/route.js`, and should be the template for all clinic-scoped collections.

**Not yet implemented:** doctor-level scoping (a second dimension — restricting a doctor to their own patients/stats within a multi-doctor clinic). Confirmed absent from `lib/rbac.js` and `app/api/dashboard/stats/route.js` as of this writing. Any new work here needs an explicit design decision first (see PRD.md open question).

## Folder Structure (verified, top-level)
```
app/
  (app)/              → authenticated app shell (dashboard, patients, appointments, etc.)
  api/                → Next.js Route Handlers, ~81 routes
  book/[slug]/        → public online booking portal (no auth)
  consent/            → patient consent form flows
  invoice/            → public invoice viewing
  lab-portal/         → token-based external lab access (no login)
  login/, signup/, onboarding/
  visit-summary/      → public visit summary view
components/
  dentos/             → app-specific components
  ui/                 → shadcn/ui primitives
lib/
  auth.js             → JWT/bcrypt/cookie helpers
  rbac.js             → role/permission matrix + route restriction map
  mongo.js            → DB connection
  whatsapp.js, lab-case-helpers.js, audit.js, etc.
middleware.js          → route-level auth + role gating (see Rules.md for how to extend)
```

## Route Handler Pattern (verified, consistent across sampled files)
Each `route.js` typically defines its own local `cors()`, `json()`, `err()`, `clean()` helpers and a local `requireUser()` — this is repeated per-file rather than centrally shared. **Do not silently refactor this into a shared module** without a deliberate decision (see Rules.md) — it works today and touching it broadly risks regressions across ~81 files for a low-value cleanup.

## Public / Unauthenticated Routes (by design — do not add auth to these)
`/book/[slug]/*` (patient booking), `/lab-portal/[id]/*` (token-based lab access), `/consent-requests/[id]/sign` (token-based consent signing), `/public/invoice/[shareToken]`, `/public/visit-summary/[visitId]`, `/subscriptions/webhook` (Razorpay), `/appointments/today-by-doctor` (internal service key, not user auth).

## Confirmed Security Gaps (must fix, not architectural — see Phases.md Phase 1 & 3)
- `app/api/ai/analyze-xray/route.js` and `app/api/voice/transcribe/route.js` have **no auth check at all** — anyone can call them and burn paid Gemini/Groq quota. `analyze-xray` additionally has an SSRF risk (fetches arbitrary client-supplied `imageUrl` server-side).
- `JWT_SECRET` falls back to a hardcoded dev value if unset.
- Auth cookie hardcodes `secure: false`.
- CORS defaults to `*` + `credentials: true` if `CORS_ORIGINS` env var is unset.
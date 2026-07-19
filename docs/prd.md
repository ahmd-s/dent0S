# DentOS — Project Requirements Document

## What This Is
DentOS is a cloud-based Dental Practice Management System for Indian dental clinics, built by Connec8. It is a working prototype with real users on a waitlist (20–30 interested clinics, none onboarded yet), not yet production-ready.

## Current Goal (as of this doc)
Not a rewrite. Not a new feature race. The current goal is: **refine and harden the existing product so that if a clinic agrees to onboard tomorrow, it can be set up immediately** — meaning the core workflow is correct, secure, and won't embarrass the business or endanger patient data.

## Target Users / Roles
- **Admin** (clinic owner/manager) — full access: settings, billing, staff, all clinical/patient data across the whole clinic.
- **Doctor** — clinical work: patients, visits, appointments, lab cases, inventory. Billing is read-only. No settings/staff access. **Open design question, not yet resolved:** whether a doctor should be scoped to only their own patients/appointments/revenue when a clinic has multiple doctors (see Architecture.md and the priority plan for current status — this does not exist in code yet).
- **Receptionist** — appointments, billing, basic patient info (name/phone/age/code only — no clinical notes, no allergies, no medical history). No settings, inventory, lab cases, or visit notes.
- **Super Admin** (Connec8-level, not yet built) — cross-clinic visibility for support/ops. Scope not yet designed.
- **Lab vendor** — no login; accesses a single case via a secure, token-based, expiring link (no account needed).
- **Patient** — no login for the core app; interacts only via the public booking portal (`/book/[slug]`) and, where applicable, consent-signing and invoice-viewing links.

Solo-clinic reality: not every clinic has a receptionist. When there isn't one, the doctor must be able to perform the full workflow (booking, check-in, billing) themselves — role permissions should not assume a receptionist always exists.

## Core Workflow (the thing the product actually does)
Patient Registration → Appointment Booking → Reception Check-In → Consultation (clinical entry: chief complaint, diagnosis, treatment, prescription) → Billing (invoice, payment, outstanding tracking) → Lab Case (if applicable: send to vendor, track status via secure portal, receive) → Follow-Up.

## Modules (current, real, implemented — not aspirational)
Dashboard, Patients, Appointments, Billing, Lab Cases, Vendors, Inventory, Consent Forms, Public Booking Portal, Settings. Plus: voice recorder + AI transcription on visits (good user feedback, real differentiator), AI clinical summary (doctor-facing quick reference, NOT patient/insurance-facing), AI X-ray analysis (Gemini), WhatsApp sharing (manual, not yet automated reminders).

## Business Model Constraints That Affect Product Behavior
- Pricing: ₹999/month or ₹9,999/year (Cloud). No free trial currently.
- Local/enterprise deployment pricing not yet decided — do not build product logic that assumes a specific Local pricing model yet.
- Subscription lifecycle (planned, not built): Active → 15-day grace period on missed payment → feature lockout. **Patients' existing clinical records must remain viewable during lockout** — only new actions (bookings, new invoices) should be blocked. This is a deliberate ethical/legal decision, not a technical default.
- Multi-branch clinics must have separate billing per branch.
- No GST registration currently — invoices are simple, generated post-visit, stored, and sent to the patient. Do not add GST logic unless explicitly requested.

## Explicit Non-Goals (do not build toward these without a new conversation)
- Hospital ERP, multi-specialty hospital software, enterprise healthcare platform, large radiology systems.
- Any backend/database/framework migration (NestJS, PostgreSQL, Prisma, Redis, AWS S3) — this is future-state discussion only and is explicitly out of scope for current work. See Rules.md.
- DICOM support, patient-facing mobile app, AI-driven treatment recommendations — future roadmap, not current phase.

## Known Real Users / Test State
No real clinic has been onboarded yet. "Gandhi Dental Clinic" in the current build is demo/test data, not a real customer.
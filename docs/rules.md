# DentOS — Rules.md
Guardrails for any AI tool (Cursor, Claude, etc.) working on this codebase. Read this before making changes.

## Hard Rules — Do Not Violate

1. **No framework/stack migration.** Do not introduce NestJS, PostgreSQL, Prisma, Redis, TypeScript, or any new backend framework. The current stack is Next.js (App Router) + MongoDB (native driver) + JS/JSX, and it stays that way until a separate, explicit migration project is agreed. If you think a migration would help, say so — don't do it.

2. **No rewrites.** Never propose or perform a full rewrite of a module, file, or the app as a general solution. Fix and extend incrementally. If a file is genuinely unworkable, say so explicitly and get sign-off before replacing it.

3. **`clinic_id` scoping is non-negotiable.** Every new or modified query against a clinic-scoped collection (patients, visits, appointments, invoices, lab_cases, inventory, profiles, etc.) MUST derive `clinic_id` server-side from the authenticated user's profile (via `requireUser()`-style resolution) and MUST include it in every read/update/delete filter. Never trust a `clinic_id` from request body, query params, or client state. This is the single most important rule in this document — a violation here is a patient-data breach, not a bug.

4. **Every route touching an external paid API (Gemini, Groq, Razorpay, Resend, WhatsApp service) must require authentication**, unless it's an explicitly designed public/token-based flow (booking, lab-portal, consent-signing) or a verified internal service-to-service key. When in doubt, require auth.

5. **Do not add features not on the current priority plan** without flagging it first. Scope creep is how "production ready in weeks" becomes "still not shipped in months."

6. **Preserve the existing per-file helper pattern** (`cors()`, `json()`, `err()`, `clean()`, `requireUser()` repeated per route file) unless a specific refactor is explicitly requested. It's repetitive but it works and is well-understood; don't "clean it up" as a side effect of an unrelated task.

7. **No GST/tax logic** unless explicitly requested — the clinic is not GST-registered currently.

8. **No new third-party integrations** (analytics, payment providers, messaging services) without explicit approval — each one is a new data-sharing and cost surface.

## Working Rules

9. **Before touching any file, check if the relevant module has a documented status in the priority plan.** If it's marked "confirmed working," don't refactor it just because you're in the neighborhood.

10. **When fixing a bug, fix the root cause, not the symptom.** E.g., the dashboard "doesn't refresh" bug should be fixed at the data-fetching layer (polling/revalidation), not by adding a manual refresh button as the only fix.

11. **When something can't be verified from code alone** (e.g., a bug that depends on live/deployed behavior), say so explicitly rather than guessing or assuming it's fixed.

12. **Every fix to a security-sensitive area (auth, RBAC, clinic isolation) should include what you'd test to confirm it worked** — not just "I added the check," but "here's how to verify no regression."

13. **Multi-doctor and multi-branch scoping are open design questions, not yet resolved.** Do not implement doctor-level or branch-level restrictions based on assumption — confirm the exact scoping rule first (see PRD.md open question).

14. **Subscription/billing lockout logic must never fully block access to existing patient clinical records**, even when a clinic's payment has lapsed. Only new actions (new bookings, new invoices) may be blocked. This is a deliberate policy, not a technical default — don't "simplify" it away.

## Style / Conventions
- JavaScript/JSX only, no TypeScript conversion of existing files.
- Follow existing Tailwind + shadcn/ui conventions already in `components/ui` and `components/dentos` — don't introduce a second component library or styling approach.
- Keep using native `mongodb` driver query patterns already established — no ad hoc introduction of an ORM/query builder for "just this one feature."

## When Unsure
Stop and ask, rather than making an architectural or security-relevant assumption. This is a healthcare product handling real patient data — the cost of a wrong guess here is much higher than the cost of a pause to confirm.
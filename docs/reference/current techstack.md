Frontend
Layer	Technology
Framework	Next.js 14.2.3 (App Router)
UI library	React 18
Styling	Tailwind CSS 3.4 + CSS variables
Components	shadcn/ui (Radix UI primitives, "new-york" style)
Icons	Lucide React
Theming	next-themes (light/dark)
Forms	React Hook Form + Zod
Tables	TanStack React Table
Charts	Recharts
Notifications	Sonner
Dates	date-fns, react-day-picker
HTTP client	axios (also native fetch in many places)

Backend & data
Layer	Technology
API	Next.js Route Handlers (app/api/**/route.js)
Database	MongoDB (native mongodb driver v6.6 — no ORM)
Auth	JWT (jsonwebtoken) + bcryptjs passwords, stored in httpOnly cookie dentos_token
Authorization	Custom RBAC (lib/rbac.js) — roles: admin, doctor, receptionist
Route protection	Next.js middleware (middleware.js)

File storage
Cloudinary — clinic logos, patient/visit documents, lab case attachments (folder pattern: dentos/{clinic_id}/{patientId})
External integrations
Service	Purpose
Razorpay	Subscription billing (app/api/subscriptions/)
Resend	Staff invite emails
Groq API	Voice transcription (Whisper) + structured clinical note extraction (Llama)
Google Gemini	Dental X-ray analysis (app/api/ai/analyze-xray/)
WhatsApp service	External HTTP service for messaging (lib/whatsapp.js)
Microsoft Clarity	Product analytics (components/Clarity.jsx)

Modules beyond Master Context’s list
The codebase also includes (implemented, not just planned):
Inventory (items, stock in/out, alerts, templates, movements)
Consent forms (templates, requests, PDF, token-based signing)
Public booking portal (/book/[slug])
Lab portal (token-based external access)
Voice recorder + AI transcription on visits
Smart typing templates
Treatment templates + tooth chart
Patient import, block times, notifications, onboarding flow
Tooling & testing
Package manager: Yarn 1.22
Language: JavaScript (JSX) — no TypeScript in app code
Performance scripts: scripts/measure-performance.js, scripts/performance-test.js
Backend tests: Python scripts (backend_test.py, test_double_booking.py, etc.) — manual/integration tests, not a JS test runner in package.json
Current product status (from code + Master Context alignment)
Working prototype, not production-ready
Backend described in Master Context as being reconsidered before scaling — the repo still runs on the Next.js + MongoDB monolith above


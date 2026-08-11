# DentOS — Deployment Checklist

Use this checklist for every production deployment. Complete items in order. Do not skip steps.

---

## Pre-Deployment

### 1. Environment Variables

- [ ] All required variables are set in the Vercel project settings (or equivalent):
  - `MONGO_URL`
  - `DB_NAME`
  - `JWT_SECRET`
  - `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY`
- [ ] Optional variables are configured as needed:
  - `RESEND_API_KEY` / `RESEND_FROM_EMAIL`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
  - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
  - `GROQ_API_KEY` / `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`
  - `WHATSAPP_SERVICE_URL` / `WHATSAPP_SERVICE_API_KEY`
  - `CRON_SECRET`
  - `NEXT_PUBLIC_APP_URL`
  - `CORS_ORIGINS`

### 2. Environment Validation

Run locally against the target env vars before deploying:

```bash
node scripts/verify-env.js
```

Expected output:

```
==================================
Environment validation passed.
All 4 required variables are set.
==================================
```

- [ ] `verify-env.js` exits with code `0`.
- [ ] `CORS_ORIGINS` is set to production domain (not `*`).
- [ ] `CRON_SECRET` is set for background job cron.
- [ ] `ATLAS_BACKUP_ENABLED=true` if Atlas continuous backup is active.

### 2b. Security Headers & Rate Limits

- [ ] `next.config.js` secure headers deployed (HSTS, nosniff, SAMEORIGIN).
- [ ] CSRF tokens issued on login (`dentos_csrf` cookie).
- [ ] API rate limits active (`api_rate_limits` collection indexed).

### 2c. Sprint 19 Indexes

```bash
node scripts/run-indexes.js
```

- [ ] Sprint 19 indexes created (`system_logs`, `background_jobs`, `api_rate_limits`).

### 3. Build Validation

```bash
npm run build
```

- [ ] Build completes with no errors.
- [ ] No TypeScript / ESLint errors in output.

### 4. Pre-Deployment Database Snapshot

- [ ] Take a manual Atlas snapshot (label: `pre-deploy YYYY-MM-DD`).
- [ ] Record Snapshot ID in deployment log.

---

## Deployment

### 5. Deploy to Vercel

```bash
vercel --prod
```

or trigger via the Vercel dashboard / GitHub integration.

- [ ] Deployment completes with status **Ready**.
- [ ] No build errors in Vercel build logs.

---

## Post-Deployment Verification

### 6. Health Endpoint

```bash
curl https://app.yourclinic.com/api/health
```

Expected response (HTTP 200):

```json
{
  "status": "ok",
  "database": "connected",
  "environment": "production",
  "timestamp": "2026-08-08T00:00:00.000Z"
}
```

- [ ] Status is `ok`.
- [ ] Database is `connected`.
- [ ] HTTP status code is `200`.

### 7. Authentication

- [ ] **Login** — clinic staff can log in with email and password.
- [ ] **Google OAuth** — `Sign in with Google` completes successfully.
- [ ] **Password Reset** — reset email is received and link works.
- [ ] **Platform Admin** — platform admin login + TOTP 2FA completes.

### 8. Core Clinic Workflows

- [ ] **Dashboard** — loads clinic stats without error.
- [ ] **Patients** — patient list loads; can search and open a patient record.
- [ ] **Appointments** — today's appointment list is visible.
- [ ] **Visits** — can open a visit, view tooth chart, add notes.
- [ ] **Billing / Invoices** — invoice list loads; can create a test invoice.

### 9. Platform Admin

- [ ] **Clinic list** loads in the platform admin panel.
- [ ] **Audit log** records are visible.
- [ ] **Inactive clinics** report loads correctly.
- [ ] **Enterprise Monitoring** (`/platform-admin/monitoring`) loads.
- [ ] **Backup Center** (`/platform-admin/backup`) shows database status.
- [ ] **Diagnostics** (`/platform-admin/diagnostics`) health score ≥ 80%.

### 9b. System Health (Clinic)

- [ ] **System Health** (`/settings/system`) loads for admin users.
- [ ] Health score and database latency displayed.
- [ ] Clinic diagnostics pass without critical failures.

### 9c. Background Jobs

- [ ] Cron `/api/cron/jobs` scheduled (every 15 min in vercel.json).
- [ ] Communication queue processing runs without failed jobs.

### 10. Email Sending

- [ ] Trigger a password reset email — confirm it arrives.
- [ ] (If applicable) Trigger an invite email — confirm it arrives.

### 11. Subscription Webhook

- [ ] Razorpay webhook endpoint is reachable at `/api/subscriptions/webhook`.
- [ ] Confirm the webhook secret matches what is registered in the Razorpay dashboard.
- [ ] (If in test mode) Trigger a test webhook event from the Razorpay dashboard and confirm it is processed without error.

---

## Sign-Off

| Step | Verified by | Time (UTC) |
|------|-------------|------------|
| Health endpoint | | |
| Login | | |
| Dashboard | | |
| Patients | | |
| Billing | | |
| Platform Admin | | |
| Google OAuth | | |
| Password Reset | | |
| Email sending | | |
| Subscription webhook | | |

**Deployment approved by:** ______________________

**Date:** ______________________

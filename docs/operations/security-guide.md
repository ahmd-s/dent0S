# DentOS — Security Guide (Sprint 19)

## Authentication

- JWT in httpOnly cookie `dentos_token`
- `JWT_SECRET` required — no fallback in production
- Platform Admin: TOTP 2FA via `platform-admin-auth.js`
- Login brute-force protection: 5 attempts / 15 min (`login-rate-limit.js`)

## CSRF Protection

- Double-submit cookie pattern
- Cookie: `dentos_csrf` (set on login)
- Header: `X-CSRF-Token` (required for mutations when enforced)
- Helpers: `lib/security.js` — `validateCsrf()`, `setCsrfCookie()`

## Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| Default API | 120 req | 1 min |
| AI / Voice | 30 req | 1 min |
| Communication | 60 req | 1 min |
| Auth | 20 req | 15 min |
| Upload | 20 req | 1 min |

Implementation: `lib/api-rate-limit.js`

## Input Validation

- `sanitizeString()` — strip HTML/scripts
- `sanitizePath()` — path traversal prevention
- `isAllowedExternalUrl()` — SSRF guard for external URLs
- `validateFileUpload()` — MIME type and size limits
- `sanitizeAiPrompt()` — prompt injection filtering

## Secure Headers (next.config.js)

Production headers include:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN` (except `/book/*`, `/lab-portal/*`)
- `Referrer-Policy: strict-origin-when-cross-origin`

## CORS

Set `CORS_ORIGINS` to your production domain(s). Avoid wildcard `*` in production.

## Secrets

Never commit:

- `.env`, `.env.local`
- `JWT_SECRET`, `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY`
- API keys (Groq, Gemini, Razorpay, Cloudinary, Resend)

Validate before deploy:

```bash
npm run verify-env
```

## AI Endpoint Security

- All AI routes require authentication + clinical RBAC
- X-ray analysis: URL allowlist via `isAllowedImageUrl()` in ai-engine
- Voice transcribe: file type/size validation

## Cron / Webhook Auth

- Cron routes: `CRON_SECRET` via Bearer or `x-cron-secret`
- Razorpay webhook: signature verification via `RAZORPAY_WEBHOOK_SECRET`

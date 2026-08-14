#!/usr/bin/env node

const REQUIRED = [
  'MONGO_URL',
  'DB_NAME',
  'JWT_SECRET',
  'PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY',
]

const OPTIONAL = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CRON_SECRET',
  'WHATSAPP_SERVICE_URL',
  'WHATSAPP_SERVICE_API_KEY',
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
]

const missing = REQUIRED.filter((key) => !process.env[key]?.trim())
const missingOptional = OPTIONAL.filter((key) => !process.env[key]?.trim())

if (missingOptional.length > 0) {
  console.warn('\n==================================')
  console.warn('Optional Environment Variables Not Set')
  console.warn('(These features will be disabled)')
  missingOptional.forEach((key) => console.warn(`  - ${key}`))
  console.warn('==================================\n')
}

if (missing.length > 0) {
  console.error('\n==================================')
  console.error('Missing Required Environment Variables\n')
  missing.forEach((key) => console.error(`  - ${key}`))
  console.error('\n==================================\n')
  process.exit(1)
}

console.log('\n==================================')
console.log('Environment validation passed.')
console.log(`All ${REQUIRED.length} required variables are set.`)
console.log('==================================\n')
process.exit(0)

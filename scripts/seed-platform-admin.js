import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { getDb, closeDb } from '../lib/mongo.js'

const email = (process.env.PLATFORM_ADMIN_EMAIL || '').toLowerCase().trim()
if (!email) {
  console.error('PLATFORM_ADMIN_EMAIL env var is required')
  process.exit(1)
}
if (!process.env.MONGO_URL) {
  console.error('MONGO_URL env var is required')
  process.exit(1)
}

async function main() {
  const db = await getDb()
  const existing = await db.collection('profiles').findOne({ is_platform_admin: true })
  if (existing) {
    console.log('Platform admin account already exists:', existing.email)
    await closeDb()
    process.exit(0)
  }

  const placeholder = crypto.randomBytes(32).toString('base64url')
  await db.collection('profiles').insertOne({
    id: uuidv4(),
    clinic_id: null,
    email,
    password_hash: await bcrypt.hash(placeholder, 10),
    full_name: 'Connec8 Platform Admin',
    role: 'admin',
    phone: '',
    is_active: true,
    is_platform_admin: true,
    email_verified: true,
    totp_enabled: false,
    created_at: new Date(),
  })

  console.log('Platform admin account created for:', email)
  console.log('Use Forgot Password on /login to set your password, then complete 2FA setup on first login.')
  await closeDb()
  process.exit(0)
}

main().catch(async (e) => {
  console.error('Seed failed:', e)
  await closeDb()
  process.exit(1)
})

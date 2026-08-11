# DentOS

**The Clinic OS for Modern Dentists** — multi-tenant dental practice management built for real clinics in India.

DentOS v1.0 Enterprise Release is a production-ready SaaS covering the full clinic workflow: reception → patient → appointment → visit → billing → lab → inventory → communication → analytics → platform admin.

## Stack

- **Framework:** Next.js 14 (App Router), React 18, JavaScript/JSX
- **UI:** Tailwind CSS, shadcn/ui, Lucide icons
- **Database:** MongoDB (native driver)
- **Auth:** JWT + httpOnly cookies, RBAC, Platform Admin TOTP 2FA
- **Deployment:** Vercel-compatible (standalone output)

## Quick Start

```bash
yarn install
npm run verify-env
node scripts/run-indexes.js
npm run dev
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `MONGO_URL` | MongoDB connection string |
| `DB_NAME` | Database name |
| `JWT_SECRET` | Auth token signing secret |
| `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY` | Platform admin 2FA encryption |

See [Deployment Checklist](docs/operations/deployment-checklist.md) for the full list.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System overview |
| [System Diagram](docs/architecture/system-diagram.md) | Engine dependencies, API map |
| [PRD](docs/prd.md) | Product requirements |
| [v1.0 Release](docs/v1.0-enterprise-release.md) | Enterprise release report |
| [Developer Onboarding](docs/developer-onboarding.md) | Developer setup guide |
| [Deployment Checklist](docs/operations/deployment-checklist.md) | Production deploy steps |
| [Security Guide](docs/operations/security-guide.md) | Security hardening |
| [Recovery Guide](docs/operations/recovery-guide.md) | Backup and recovery |

## Project Structure

```
app/(app)/       → Authenticated clinic app
app/api/         → Route handlers
app/platform-admin/ → Platform administration
components/      → UI components
lib/             → Engines and utilities
docs/            → Documentation
```

## Health Check

```bash
curl http://localhost:3000/api/health
```

## License

Proprietary — All rights reserved.

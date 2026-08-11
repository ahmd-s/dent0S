# Developer Onboarding — DentOS v1.0

Welcome to the DentOS codebase. This guide gets you productive quickly.

## Prerequisites

- Node.js 18+
- Yarn 1.22
- MongoDB (local or Atlas)
- Environment variables configured

## First Setup

```bash
git clone <repo>
cd DentOS
yarn install
npm run verify-env
node scripts/run-indexes.js
npm run dev
```

Open `http://localhost:3000/login`.

## Architecture Principles

1. **Multi-tenancy:** Every clinic-scoped query includes `clinic_id` derived server-side from the authenticated profile. Never trust client-supplied `clinic_id`.

2. **Engine pattern:** Business logic lives in `lib/*-engine.js`. API routes delegate to engines — no HTTP/auth inside engines.

3. **Additive changes:** Do not rewrite engines or break APIs. Extend via new functions, collections, and routes.

4. **Workspace-driven UI:** Navigation, dashboard widgets, and patient page sections are controlled by the Workspace Engine per clinic/role.

## Key Directories

| Path | Purpose |
|------|---------|
| `lib/authorization-engine.js` | RBAC, route restrictions, feature flags |
| `lib/workspace-engine.js` | Per-clinic workspace configuration |
| `lib/activity-engine.js` | Patient/clinic timeline events |
| `lib/analytics-engine.js` | BI calculations |
| `lib/communication-engine.js` | Outbound messaging |
| `lib/ai-engine.js` | AI orchestration |
| `lib/system-observability.js` | Production logging |
| `lib/job-manager.js` | Background jobs |
| `middleware.js` | Page-level auth gating |

## Adding a Dashboard Widget

1. Create component in appropriate `*FlowWidgets.jsx`
2. Register in `DashboardWidgetRegistry.jsx`
3. Add default `false` in `workspace-template-defaults.js`
4. Wire data in `app/api/dashboard/stats/route.js` if needed

## Adding an API Route

```js
import { requireUser, json, err, cors } from '@/lib/api-helpers'

export async function GET() {
  const ctx = await requireUser()
  if (!ctx) return err('Unauthorized', 401)
  const { profile, clinic, db } = ctx
  const cid = profile.clinic_id
  // Always filter by clinic_id: cid
  return json({ ok: true })
}
```

## Running Indexes

After schema changes in `lib/setup-indexes.js`:

```bash
node scripts/run-indexes.js
```

## Production Deploy

Follow [deployment-checklist.md](operations/deployment-checklist.md) exactly.

## Code Style

- JavaScript/JSX (no TypeScript)
- Match surrounding file conventions
- Use shadcn/ui components from `components/ui/`
- Toasts via Sonner (`import { toast } from 'sonner'`)
- Minimize scope — focused diffs only

## Getting Help

- Architecture: `docs/architecture.md`
- Security: `docs/operations/security-guide.md`
- Sprint history: `docs/v1.0-enterprise-release.md`

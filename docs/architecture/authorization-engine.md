# Authorization Engine — Architecture Reference

## Overview

`lib/authorization-engine.js` is the **single source of truth** for every authorization
decision in DentOS. All permission checks must flow through this module (directly or
via facades).

Facades for backward compatibility:

| Module | Role |
|--------|------|
| `lib/rbac.js` | Re-exports RBAC helpers (existing imports unchanged) |
| `lib/clinic-access.js` | Clinic blocked checks |
| `lib/authorization-helpers.js` | Route guards (`guardApiSync`, `guardApi`) |
| `lib/api-helpers.js` | Re-exports guards for API routes |

Platform admin remains in `lib/platform-admin.js` (`requirePlatformAdmin`).

---

## Decision layers

Evaluated in order; first denial wins:

```
1. Clinic access status     subscription_status === 'blocked'
2. Feature flags            optional (checkFeatures: true)
3. RBAC matrix              role × resource × action
4. Workspace permissions    optional (checkWorkspace: true)
```

Default API behaviour is unchanged: layers 2 and 4 are **off by default** so existing
routes behave identically to pre-Sprint-8 RBAC-only checks.

---

## Core API

### `authorizeSync(opts)` — synchronous

```js
const result = authorizeSync({
  profile,           // or roles
  clinic,
  resource: 'patients',
  action: 'update',
  skipClinicCheck: false,
  checkFeatures: false,
  checkWorkspace: false,
  workspace: null,   // optional inline config
})

// result: { allowed: true, code: 'ALLOWED' }
//      or { allowed: false, code, reason, status }
```

### `authorize(opts)` — async

Same options; loads workspace from DB when `checkWorkspace: true` and `db` provided.

### Route checks

```js
authorizeRouteSync({ roles, pathname, clinic, skipClinicCheck })
authorizePlatformAdmin(profile)
```

---

## Route helpers

```js
import { guardApiSync, guardApi } from '@/lib/authorization-helpers'

// In a route handler:
const denied = guardApiSync(ctx, { resource: 'patients', action: 'create' }, err)
if (denied) return denied
```

`guardApi` adds async workspace/feature layers when opts specify them.

---

## Resources & actions

| Resource | Actions | Notes |
|----------|---------|-------|
| `patients` | read, create, update, delete | Receptionist field filtering unchanged |
| `visits` | read, create, update, delete | clinical_read for receptionist |
| `appointments` | read, create, update, delete | |
| `billing` | read, create, update, delete | Doctor read-only |
| `staff` | read, create, update, delete | Admin only |
| `settings` | read, update | Admin only |
| `inventory` | read, create, update, delete | Delete admin-only |
| `lab_cases` | read, create, update, delete | |
| `consent_templates` | read, create, update, delete | |

---

## Integration map

| Concern | Engine function / constant |
|---------|---------------------------|
| RBAC matrix | `PERMISSION_MATRIX`, `hasPermission()` |
| Route gating | `authorizeRouteSync`, `canAccessRoute()` |
| Clinic blocked | `isClinicAccessBlocked()`, `AUTH_CODES.CLINIC_BLOCKED` |
| Feature flags | `RESOURCE_FEATURE_MAP`, `checkFeatures: true` |
| Workspace | `WORKSPACE_PERMISSION_MAP`, `checkWorkspace: true` |
| Platform admin | `authorizePlatformAdmin()` |
| Middleware | `authorizeRouteSync` in `middleware.js` |

---

## Migration path

Existing code using `@/lib/rbac` requires **no changes** — it delegates to the engine.

New API routes should prefer:

```js
const denied = guardApiSync(ctx, { resource, action }, err)
if (denied) return denied
```

Enable `checkFeatures` or `checkWorkspace` explicitly when stricter gates are desired.

---

## Related files

- `lib/authorization-engine.js` — core engine
- `lib/authorization-helpers.js` — HTTP route wrappers
- `lib/rbac.js` — backward-compatible facade
- `lib/clinic-access.js` — clinic status facade
- `lib/workspace-engine.js` — workspace config (optional layer)
- `lib/platform-admin.js` — platform admin session (separate path)

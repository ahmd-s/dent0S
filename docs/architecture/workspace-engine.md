# Workspace Engine — Architecture Reference

## Overview

`lib/workspace-engine.js` is the foundation for **customizable clinic workspaces** in DentOS.
Each clinic can store per-role UI and permission configuration (navigation, dashboard widgets,
page sections, quick actions, etc.) without code changes.

This sprint builds the **engine and storage only**. It does **not**:

- Replace or modify `lib/rbac.js` (route-level RBAC remains unchanged)
- Change dashboard, sidebar, or any UI rendering
- Expose clinic-admin editing APIs (backend support only)

Future sprints will read workspace config in the frontend and optionally gate actions;
until then, existing RBAC continues to enforce access.

---

## MongoDB Collection: `clinic_workspaces`

One document per clinic. Keyed by `clinic_id` (unique index).

```js
{
  id: "uuid",
  clinic_id: "uuid",
  admin: { navigation: {...}, dashboard: {...}, ... },
  doctor: { navigation: {...}, dashboard: {...}, ... },
  receptionist: { navigation: {...}, dashboard: {...}, ... },
  created_at: Date,
  updated_at: Date,
}
```

Each role stores these sections (all boolean flag maps):

| Section | Purpose |
|---------|---------|
| `navigation` | Sidebar / top-level nav items |
| `dashboard` | Dashboard widgets and panels |
| `patient_page` | Sections on the patient detail view |
| `appointment_page` | Appointment list/detail actions |
| `billing_page` | Billing and invoice capabilities |
| `inventory_page` | Inventory management sections |
| `lab_page` | Lab case management sections |
| `reports_page` | Reports and exports |
| `quick_actions` | Header / FAB shortcuts |
| `widgets` | Reusable widget visibility |
| `permissions` | Fine-grained action flags (future UI enforcement) |
| `layout` | Layout preferences (e.g. compact mode) |

Platform-wide default templates are stored in `platform_settings.workspace_templates`
and fall back to code defaults in `DEFAULT_ROLE_TEMPLATES` when unset.

---

## Flow

### Signup → default workspace

```
Email signup                    Google signup
     │                               │
     ▼                               ▼
auth/signup/route.js      createClinicOwnerAccount()
     │                               │
     └───────────┬───────────────────┘
                 ▼
        createDefaultWorkspace(db, clinicId)
                 │
                 ▼
     clinic_workspaces.insertOne(...)
     (uses platform templates + mergeDefaults)
```

Both signup paths call `createDefaultWorkspace()` after clinic, profile, and trial creation.

### Read path (future UI)

```
getRoleWorkspace(db, clinicId, role)
        │
        ▼
  mergeDefaults(stored, platform_templates)
        │
        ▼
  { navigation, dashboard, ... }  →  UI reads flags
```

Stored values win over defaults. Missing keys are filled from platform templates,
which themselves merge over `DEFAULT_ROLE_TEMPLATES`.

### Platform admin

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/platform-admin/workspaces` | Platform templates |
| `GET` | `/api/platform-admin/workspaces?clinic_id=…` | Merged clinic workspace |
| `PATCH` | `/api/platform-admin/workspaces` | Update templates, clinic role, or reset |

PATCH body examples:

```js
// Reset platform templates to code defaults
{ "reset": "platform" }

// Reset one clinic to current platform templates
{ "reset": "clinic", "clinic_id": "…" }

// Partial platform template update
{ "templates": { "doctor": { "navigation": { "billing": true } } } }

// Update one role for a clinic
{ "clinic_id": "…", "role": "receptionist", "config": { "dashboard": { "ai_summary": true } } }
```

All mutations are audit-logged via `platform_admin_audit_logs`.

---

## Engine Functions

| Function | Description |
|----------|-------------|
| `createDefaultWorkspace(db, clinicId)` | Insert default doc for new clinic (idempotent) |
| `getWorkspace(db, clinicId)` | Full merged workspace for all roles |
| `getRoleWorkspace(db, clinicId, role)` | Merged config for one role |
| `saveWorkspace(db, clinicId, input)` | Validate and upsert clinic workspace |
| `resetClinicWorkspace(db, clinicId)` | Reset clinic to platform templates |
| `getPlatformTemplates(db)` | Platform templates merged with code defaults |
| `updatePlatformTemplates(db, partial)` | Patch platform templates |
| `resetPlatformTemplates(db)` | Clear platform override → code defaults |
| `mergeDefaults(partial, defaults)` | Deep merge; missing keys filled |
| `validateWorkspace(workspace, opts)` | Structural validation |

Return shape: `{ ok: true, … }` or `{ ok: false, error, code }`.

---

## Default Role Templates

Three roles align with `lib/profile-roles.js`: `admin`, `doctor`, `receptionist`.

- **Admin** — full visibility and permissions
- **Doctor** — clinical focus; billing/settings/revenue restricted
- **Receptionist** — front-desk focus; clinical sections restricted

Defaults live in `DEFAULT_ROLE_TEMPLATES` inside the engine module.

---

## Future Expansion (no migration required)

1. **New boolean keys** — Add to `DEFAULT_ROLE_TEMPLATES`. `mergeDefaults()` fills them
   into existing clinic documents on read; optional backfill on write.
2. **New sections** — Add to `WORKSPACE_SECTIONS` and defaults; validation requires them
   for new saves; reads merge missing sections from defaults.
3. **Clinic admin UI** — Call `getWorkspace` / `saveWorkspace` from new clinic-admin routes
   (not implemented in Sprint 5).
4. **UI enforcement** — Frontend reads `getRoleWorkspace` alongside existing RBAC;
   workspace flags hide/show elements; RBAC still blocks unauthorized API calls.
5. **Version field** — Can be added later to `clinic_workspaces` for template versioning
   without breaking existing documents.

---

## Workspace Builder (Sprint 6)

Clinic admins configure per-role workspaces at **Settings → Workspace Builder**
(`/settings/workspace`).

### Flow

```
Clinic admin opens /settings/workspace
        │
        ▼
GET /api/settings/workspace
        │
        ▼
createDefaultWorkspace (if missing) → getWorkspace
        │
        ▼
WorkspaceBuilder UI — edit role + tab
        │
        ▼
PATCH /api/settings/workspace { role, config }
        │
        ▼
saveWorkspace → validateWorkspace + validateWorkspaceBusinessRules
        │
        ▼
clinic_workspaces updated
```

### UI structure

| Area | Purpose |
|------|---------|
| Role sidebar | Select Admin / Doctor / Receptionist |
| Preview dropdown | Same roles — switches editor context instantly |
| Tabs | Navigation, Dashboard, Patient Page, Quick Actions, Widgets, Layout |
| Save | Manual save only (no autosave) |
| Reset | Per-role or entire clinic (confirmation modal) |

### Validation (UI + engine)

- `navigation.dashboard` and `navigation.patients` must stay enabled (locked toggles)
- Layout `density`: `compact` \| `comfortable` \| `expanded`
- Layout `view_mode`: `cards` \| `list` \| `two-column`
- Widget order stored in `layout.widget_order` (drag-and-drop in Widgets tab)

### Clinic admin API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/settings/workspace` | Clinic admin (`canAccessSettings`) |
| `PATCH` | `/api/settings/workspace` | Clinic admin |

RBAC and route access are **unchanged** — workspace flags are stored for future
UI consumption; the builder does not alter `lib/rbac.js`.

---

## Live Integration (Sprint 7)

Workspace config drives the live UI via `WorkspaceProvider` (mounted in `app/(app)/layout.js`).

| Surface | Mechanism |
|---------|-----------|
| Sidebar | `navigationOrder` + `NAV_REGISTRY`; RBAC still filters routes |
| Dashboard | `WorkspaceWidget` + ordered `dashboardWidgets` |
| Quick actions | `WorkspaceGate section="quick_actions"` |
| Patient page | `WorkspaceGate section="patient_page"` on tabs/sections |
| Layout | `layoutClasses` on `<main>` (density / view mode) |

Fetch once: `GET /api/workspace` (read-only, all clinic users). Refresh via
`refreshWorkspace()` or `dentos:workspace-updated` event after builder save.

---

## Related Files

| File | Role |
|------|------|
| `lib/workspace-engine.js` | Engine — all workspace logic |
| `lib/workspace-ui-schema.js` | Builder field definitions and client validation |
| `lib/workspace-template-defaults.js` | Expanded default templates |
| `app/api/platform-admin/workspaces/route.js` | Platform admin API |
| `app/api/settings/workspace/route.js` | Clinic admin workspace API |
| `app/(app)/settings/workspace/page.js` | Workspace Builder page |
| `components/settings/workspace/*` | Builder UI components |
| `lib/create-clinic-owner.js` | Google signup hook |
| `app/api/auth/signup/route.js` | Email signup hook |
| `lib/setup-indexes.js` | `clinic_workspaces.clinic_id` unique index |
| `lib/rbac.js` | Unchanged — continues to enforce route access |

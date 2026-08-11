# Activity & Event Engine

Sprint 10 — centralized event stream for DentOS.

## Overview

Every important clinic action writes a standardized document to `activity_events`. This is the single source for:

- Patient Timeline tab
- Dashboard Recent Activity widget
- Clinic Activity viewer (`/settings/activity`)
- Reports activity summary
- Platform Admin clinic timeline (merged with existing audit sources)

## Architecture

```
Module write path (API route)
  ↓
logActivity() / logEvent()  [best-effort]
  ↓
activity_events collection
  ↓
Timeline APIs → UI / Reports / Platform Admin
```

Existing lab `audit_logs` and platform `platform_admin_audit_logs` remain unchanged. Activity Engine is additive.

## Collection: `activity_events`

```js
{
  id: string,
  clinic_id: string,
  patient_id: string | null,
  visit_id: string | null,
  appointment_id: string | null,
  invoice_id: string | null,
  lab_case_id: string | null,
  module: string,           // patients, appointments, visits, billing, lab, ...
  event: string,            // PATIENT_CREATED, VISIT_STARTED, ...
  actor_id: string | null,
  actor_name: string,
  actor_role: string,
  metadata: object,
  created_at: Date,
}
```

## Key files

| File | Purpose |
|------|---------|
| `lib/activity-event-registry.js` | Event constants, labels, module map |
| `lib/activity-engine.js` | `logEvent`, timeline queries, grouping |
| `lib/activity-helpers.js` | `logActivity`, `actorFromProfile` for routes |

## API routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/timeline/patient/[id]` | Patient timeline |
| GET | `/api/timeline/visit/[id]` | Visit timeline |
| GET | `/api/timeline/appointment/[id]` | Appointment timeline |
| GET | `/api/timeline/clinic` | Clinic-wide stream |
| GET | `/api/reports/activity-summary` | Module event counts |

### Query parameters (timeline routes)

- `limit`, `page`, `cursor` — pagination
- `module`, `event` — filters
- `from`, `to` — date range (ISO date)
- `modules`, `events` — comma-separated multi-filters
- `actor_id` — filter by actor

## Integrated modules

Events are logged from existing write paths in:

- Appointments, Visits, Patients, Billing/Invoices
- Lab cases, Inventory consume, Consent, Documents
- Team (staff), Workspace builder

## Indexes

Created via `lib/setup-indexes.js`:

- `clinic_id + created_at`
- `patient_id + created_at`
- `visit_id + created_at`
- `appointment_id + created_at`
- `module + created_at`
- `event + created_at`

Run `POST /api/setup-indexes` after deploy.

## UI

- **Patient page** — Timeline tab (`PatientTimelineTab`)
- **Dashboard** — Recent Activity widget
- **Settings → Activity** — full Activity Viewer with filters
- **Reports** — module summary + activity feed

## Design rules

1. `logEvent` never throws — logging failures must not break operations
2. No duplicate business logic — log after successful writes only
3. Use `ACTIVITY_EVENTS` constants from registry — no magic strings
4. Future features should read from Activity Engine, not create parallel history stores

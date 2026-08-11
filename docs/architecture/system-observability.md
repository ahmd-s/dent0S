# System Observability Engine — Sprint 19

Centralized logging and performance monitoring for DentOS production deployments.

## Location

`lib/system-observability.js`

## Responsibilities

- System logs, API logs, errors, warnings
- Performance metrics and request timings
- Slow query detection (delegates to `performance-monitor.js`)
- Background job status logging
- Unhandled exception capture

## MongoDB Collection

| Collection | Indexes |
|------------|---------|
| `system_logs` | `created_at`, `clinic_id+created_at`, `level+created_at`, `category+created_at` |

## API

```js
import { logSystemEvent, logApiRequest, logDbOperation, logError, getObservabilityMetrics } from '@/lib/system-observability'
```

## Integration

- `lib/api-helpers.js` — `withApiObservability()` wrapper
- Platform Admin Monitoring — `/api/platform-admin/monitoring`
- Clinic System Health — `/api/system/health`

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `OBSERVABILITY_PERSIST` | false (dev) | Force MongoDB persistence in dev |
| `SLOW_QUERY_MS` | 100 | Slow DB query threshold |
| `SLOW_API_MS` | 500 | Slow API threshold |
| `LOG_RETENTION_DAYS` | 30 | Auto-cleanup via job manager |

## Design Rules

- **No duplicate logging** — all production logs flow through this module
- Business audit remains in Activity Engine and Platform Admin audit
- Best-effort persistence — never throws to callers

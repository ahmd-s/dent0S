# DentOS — System Architecture Diagram (Sprint 19)

## Engine Dependency Map

```mermaid
flowchart TB
  subgraph Client
    UI[React App Shell]
    Offline[Offline Sync Client]
    Autosave[Autosave Client]
    EB[Global Error Boundary]
  end

  subgraph API[Next.js API Routes]
    Helpers[api-helpers]
    Security[security.js]
    RateLimit[api-rate-limit.js]
  end

  subgraph Observability[Sprint 19]
    Obs[system-observability.js]
    Jobs[job-manager.js]
    Diag[diagnostics-engine.js]
  end

  subgraph Engines[Business Engines]
    AuthZ[authorization-engine]
    WS[workspace-engine]
    Sub[subscription-engine]
    Act[activity-engine]
    Ana[analytics-engine]
    Comm[communication-engine]
    AI[ai-engine]
  end

  subgraph Data[MongoDB]
    Collections[(Collections)]
    SystemLogs[(system_logs)]
    JobsCol[(background_jobs)]
  end

  UI --> Helpers
  Offline --> Helpers
  Autosave --> UI
  EB --> UI
  Helpers --> Security
  Helpers --> RateLimit
  Helpers --> Obs
  Helpers --> AuthZ
  Helpers --> Engines
  Jobs --> Comm
  Jobs --> Ana
  Jobs --> Obs
  Diag --> Collections
  Obs --> SystemLogs
  Jobs --> JobsCol
  Engines --> Collections
```

## Collections (Sprint 19 Additions)

| Collection | Purpose |
|------------|---------|
| `system_logs` | Centralized observability |
| `background_jobs` | Job queue and status |
| `api_rate_limits` | API abuse protection |

## API Map (Sprint 19)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/system/health` | Clinic user | Clinic system health |
| `GET /api/system/diagnostics` | Clinic user | Clinic diagnostics |
| `GET /api/platform-admin/monitoring` | Platform admin | Enterprise monitoring |
| `GET /api/platform-admin/backup` | Platform admin | Backup status |
| `GET /api/platform-admin/diagnostics` | Platform admin | Platform diagnostics |
| `GET /api/cron/jobs` | CRON_SECRET | Background job processor |

## Indexes

Run after deploy:

```bash
node scripts/run-indexes.js
```

Sprint 19 indexes are defined in `lib/setup-indexes.js` under "Sprint 19 collections".

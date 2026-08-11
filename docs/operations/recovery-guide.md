# DentOS — Recovery Guide (Sprint 19)

## Database Recovery

1. **Identify failure** — check `/api/health` and Platform Admin → Backup Center
2. **Atlas snapshot restore** — use pre-deploy snapshot or PITR (see `docs/operations/backup-restore.md`)
3. **Verify indexes** — `node scripts/run-indexes.js`
4. **Run diagnostics** — Platform Admin → Diagnostics

## Application Recovery

### Failed Background Jobs

1. Platform Admin → Monitoring → Queues tab
2. Review recent failures
3. Cron `/api/cron/jobs` runs every 15 minutes with automatic retry (max 3 attempts)

### Offline Write Queue (Client)

1. User reconnects — automatic sync via `offline-sync-client.js`
2. Manual sync — click "Sync now" in offline banner
3. Conflicts — status `409`; user must review and re-save

### Draft Recovery

Autosaved drafts stored in localStorage:

| Scope | Key pattern |
|-------|-------------|
| Patient notes | `dentos_draft_patient_notes_{id}` |
| Workspace builder | `dentos_draft_workspace_builder_{role}` |
| Visit drafts | Existing server-side + `visit_draft` scope |

### Error Boundaries

- Global error boundary in app layout — "Try again" and "Refresh page"
- Component-level boundaries on inventory pages

## Health Score Recovery

| Score | Action |
|-------|--------|
| 80–100 | Normal operation |
| 60–79 | Review warnings in Diagnostics |
| Below 60 | Address failed checks before next deploy |

## Post-Recovery Checklist

- [ ] Health endpoint returns `ok`
- [ ] Login works (clinic + platform admin)
- [ ] Diagnostics health score ≥ 80%
- [ ] No failed jobs in queue
- [ ] Core workflows tested (patients, visits, billing)

## RPO / RTO Targets

- **RPO:** ≤ 1 hour (Atlas continuous backup)
- **RTO:** ≤ 4 hours (documented in backup-restore.md)

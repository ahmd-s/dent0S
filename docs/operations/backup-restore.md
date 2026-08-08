# DentOS — Backup & Restore Operations

> **Documentation only.** No implementation code. Follow these procedures before and after every production deployment.

---

## 1. MongoDB Atlas Backup

### 1.1 Verify Continuous Backup is Enabled

1. Open [MongoDB Atlas](https://cloud.mongodb.com) → **Data Services** → your cluster.
2. Navigate to **Backup** → **Continuous Backup**.
3. Confirm status is **Active**.
4. Confirm the **Backup Region** matches your cluster region.
5. Confirm the **Snapshot Frequency** is set to **Hourly** or better.
6. Confirm **Point-in-Time Restore** is enabled with at least a **7-day** window.

### 1.2 Manual On-Demand Snapshot (Pre-Deployment)

Before any major deployment or migration:

1. Go to **Backup** → **Snapshots** → **Take Snapshot Now**.
2. Add a description: `pre-deploy YYYY-MM-DD`.
3. Wait for status to reach **Completed** before proceeding.
4. Record the Snapshot ID in your deployment log.

### 1.3 Snapshot Retention Policy (Recommended)

| Frequency     | Retention |
|---------------|-----------|
| Hourly        | 2 days    |
| Daily         | 7 days    |
| Weekly        | 4 weeks   |
| Monthly       | 12 months |

---

## 2. MongoDB Restore Process

### 2.1 Point-in-Time Restore (Preferred)

Use when you need to roll back to a specific moment (e.g., before a bad data migration).

1. Atlas → **Backup** → **Point in Time Restore**.
2. Select the target cluster (use a **new or staging cluster** — never restore over live production without approval).
3. Set the restore timestamp to the last known-good moment.
4. Click **Restore** and wait for completion.
5. Validate data in the restored cluster before switching traffic.

### 2.2 Snapshot Restore

Use when you need the state at a specific daily/weekly snapshot.

1. Atlas → **Backup** → **Snapshots** → locate the target snapshot.
2. Click **Restore** → choose **Restore to Cluster**.
3. Select a **staging or new cluster** as the destination.
4. Confirm and wait for completion (can take 15–60 minutes depending on data size).
5. Validate the restored data, then update `MONGO_URL` to point to the restored cluster if a production switch is needed.

### 2.3 Restore Validation Checklist

After any restore:

- [ ] Clinics collection has expected number of documents.
- [ ] Patients collection record count is reasonable.
- [ ] Most recent visits are present.
- [ ] Platform admin profile exists and TOTP is intact.
- [ ] Indexes are present (run `node scripts/run-indexes.js` against restored DB).
- [ ] Health endpoint returns `{ "status": "ok", "database": "connected" }`.
- [ ] At least one test login succeeds.

---

## 3. Cloudinary Asset Recovery

DentOS stores X-rays, documents, lab attachments, and clinic logos in Cloudinary.

### 3.1 Verify Cloudinary Backup is Active

1. Log in to [Cloudinary Console](https://console.cloudinary.com).
2. Navigate to **Settings** → **Security**.
3. Confirm **Auto Backup** or **Google Cloud Storage / AWS S3 backup** integration is enabled.

### 3.2 Asset Recovery Notes

- Cloudinary asset public IDs are stored in MongoDB documents (field: `cloudinary_url` or `public_id`).
- If an asset is accidentally deleted, use the Cloudinary Console → **Media Library** → search by public ID.
- If the entire Cloudinary account is compromised, restore from the backup storage bucket your Cloudinary is configured to use.
- There is no application-level Cloudinary restore script; recovery must be done through the Cloudinary dashboard or API.

### 3.3 Post-Asset-Recovery Steps

- [ ] Confirm X-ray images load in patient visit records.
- [ ] Confirm clinic logos display on the dashboard.
- [ ] Confirm signed PDF consent documents are accessible.
- [ ] Re-upload any assets that could not be recovered from Cloudinary backup.

---

## 4. Recommended Backup Schedule

| Activity                            | Frequency     | Owner             |
|-------------------------------------|---------------|-------------------|
| Atlas continuous snapshot           | Hourly (auto) | Atlas (automated) |
| Manual pre-deployment snapshot      | Every deploy  | DevOps engineer   |
| Verify Atlas backup active          | Weekly        | DevOps engineer   |
| Verify Cloudinary backup active     | Monthly       | DevOps engineer   |
| Full recovery drill (staging)       | Monthly       | DevOps engineer   |

---

## 5. Recovery Objectives

| Metric                         | Target    |
|--------------------------------|-----------|
| **RPO** (Recovery Point Obj.)  | ≤ 1 hour  |
| **RTO** (Recovery Time Obj.)   | ≤ 4 hours |

- **RPO ≤ 1 hour** is achievable because Atlas continuous backup takes hourly snapshots.
- **RTO ≤ 4 hours** assumes restore-to-staging, validation, and DNS/env switch can be completed within that window. Practise the drill monthly to confirm this holds.

---

## 6. Monthly Recovery Drill Checklist

Run this checklist on the first Saturday of each month using a **staging environment**. Never run drills against production data.

- [ ] Note the date and start time of the drill.
- [ ] Trigger a manual Atlas snapshot of the production cluster. Record Snapshot ID.
- [ ] Restore the snapshot to the staging cluster.
- [ ] Update the staging `.env.local` to point `MONGO_URL` at the staging cluster.
- [ ] Run `node scripts/verify-env.js` against staging — confirm it passes.
- [ ] Start the staging app with `npm run start`.
- [ ] Hit `GET /api/health` — confirm `{ "status": "ok", "database": "connected" }`.
- [ ] Log in as a clinic user — confirm dashboard loads and patient data is visible.
- [ ] Log in as platform admin — confirm clinic list loads.
- [ ] Create a test patient record and a test visit — confirm writes succeed.
- [ ] Note the end time of the drill. Confirm RTO target (≤ 4 hours) was met.
- [ ] Document any issues found and file remediation tasks.
- [ ] Reset the staging cluster (delete test data created during the drill).

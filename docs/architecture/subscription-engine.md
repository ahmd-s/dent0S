# Subscription Engine — Architecture Reference

## Overview

`lib/subscription-engine.js` is the **single source of truth** for every subscription
state mutation in DentOS. No other file may write to the `clinics.subscription_status`,
`clinics.trial_ends_at`, `clinics.features`, `subscriptions.subscription_status`,
`subscriptions.platform_status`, or `subscriptions.grace_period_end` fields directly.

All writes go through this module, which also:
- Creates audit logs for every mutation
- Returns a standardised `SubscriptionState` object to every caller
- Validates lifecycle transitions before executing them

---

## Lifecycle State Machine

```
                          ┌─────────────────────────────────────────────────────┐
                          │                                                     │
              signup ──►  TRIAL ──────────────────────────────► CANCELLED       │
                          │  │                                      ▲           │
              payment ──► │  └────► ACTIVE ─── payment fails ──► GRACE         │
                          │             │                                       │
            PA override ──┤         admin / cron                                │
                          │             ▼                                       │
                          │          BLOCKED ◄─── emergency lock                │
                          │          PAUSED  ◄─── lifecycle action              │
                          │                                                     │
                          │  ─── platform overrides ────────────────────────►  │
                          │         COMPED · LOCKED · FORCE_ACTIVE · FORCE_TRIAL│
                          └─────────────────────────────────────────────────────┘
```

### Allowed Transitions (validated by `applyLifecycle`)

| From billing status | Target `status` | Blocked? |
|---------------------|-----------------|----------|
| `cancelled`         | `active`        | ❌ Requires `{ force: true }` |
| _any_               | `grace`         | ❌ If clinic is already blocked |
| _any_               | `trial`         | ❌ If platform override is `comped` or `locked` |
| _everything else_   | _anything_      | ✅ Allowed |

Pass `{ force: true }` in the options object to bypass validation.
Automated callers (cron, webhook) do not use `applyLifecycle` and are therefore
never affected by these guards.

---

## SubscriptionState Object

Every engine function returns `{ ok: true, state: SubscriptionState }`:

```js
{
  // Core access / billing
  clinicStatus,         // 'active' | 'blocked'
  billingStatus,        // 'trial' | 'active' | 'halted' | 'cancelled' | null
  platformStatus,       // 'comped' | 'locked' | 'force_active' | 'force_trial' | null
  trialEndsAt,          // Date | null
  graceEndsAt,          // Date | null
  currentPeriodEnd,     // Date | null
  override,             // alias for platformStatus

  // Derived booleans
  isBlocked,            // clinicStatus === 'blocked'
  isTrial,              // billingStatus === 'trial'
  isGrace,              // billingStatus === 'halted'
  isPaid,               // isActivePaidSubscription(sub)

  // Extended fields (used by Platform Admin routes)
  trialAutoEnforcement, // 'auto' | 'paused'
  monthlyAiUsageLimit,  // number | null
  features,             // { appointments, billing, ... }
  emergencyLockedAt,    // Date | null
  emergencyLockedBy,    // string | null
  emergencyLockedReason,// string | null
  planType,             // 'monthly' | 'yearly' | null
  subscriptionId,       // Razorpay subscription ID | null
  customerId,           // Razorpay customer ID | null
  paymentMethod,        // string | null
  manualAccessGrantedAt,// Date | null
  subscriptionReason, // trial_started | payment_failed | grace_expired | ...
}
```

### subscription_reason values

Stored on `subscriptions.subscription_reason` and returned by platform-admin APIs:

| Reason | Set by |
|--------|--------|
| `trial_started` | `createTrial` (signup) |
| `trial_expired` | `blockExpiredTrial` (cron) |
| `payment_failed` | `startGracePeriod` (Razorpay webhook) |
| `payment_recovered` | `activateSubscription` (Razorpay webhook) |
| `manual_payment` | `activateSubscription` (manual payment POST) |
| `grace_started` | `applyLifecycle('grace')` |
| `grace_expired` | `blockGraceExpired` (cron) |
| `manual_override` | `applyLifecycle` (admin) |
| `admin_lock` | `blockClinic` (admin toggle) |
| `emergency_lock` | `emergencyLock` |
| `cancelled` | `cancelSubscription` |

---

## Function Catalogue

### State

| Function | Description |
|----------|-------------|
| `readState(db, clinicId)` | Read current state, no writes |
| `syncSubscriptionState(db, clinicId)` | Alias for `readState` |

### Trial

| Function | Signature | Caller |
|----------|-----------|--------|
| `createTrial` | `(db, clinicId, { trialEnd, createdAt })` | signup, create-clinic-owner |
| `extendTrial` | `(db, actor, clinicId, { days })` | Platform Admin (quick +7/+14/+30) |
| `setTrialEndDate` | `(db, actor, clinicId, { date })` | Platform Admin |
| `setTrialEnforcement` | `(db, actor, clinicId, { enforcement })` | Platform Admin |

### Paid activation

| Function | Signature | Caller |
|----------|-----------|--------|
| `activateSubscription` | `(db, clinicId, opts)` | Razorpay webhook, subscriptions POST, manual payments |

### Grace & cancellation

| Function | Signature | Caller |
|----------|-----------|--------|
| `startGracePeriod` | `(db, clinicId, { graceEnd, reason? })` | Razorpay webhook (subscription.failed) |
| `cancelSubscription` | `(db, actor, clinicId)` | Razorpay webhook (subscription.cancelled) |

### Block / Unblock

| Function | Signature | Caller |
|----------|-----------|--------|
| `blockClinic` | `(db, actor, clinicId, { from? })` | Platform Admin PATCH toggle |
| `unblockClinic` | `(db, actor, clinicId, { from? })` | Platform Admin PATCH toggle |
| `blockExpiredTrial` | `(db, clinicId)` | Trial-expiry cron |
| `blockGraceExpired` | `(db, clinicId)` | Trial-expiry cron (grace expiry) |
| `pauseSubscription` | `(db, actor, clinicId, { reason? })` | Internal (lifecycle wrapper) |

### Platform overrides

| Function | Signature | Notes |
|----------|-----------|-------|
| `setPlatformOverride` | `(db, actor, clinicId, { platformStatus })` | Primary — pass null to clear |
| `compClinic` | `(db, actor, clinicId)` | Wrapper → `applyLifecycle('comped')` |
| `lockClinic` | `(db, actor, clinicId)` | Wrapper → `applyLifecycle('locked')` |
| `forceTrial` | `(db, actor, clinicId)` | Wrapper → `setPlatformOverride('force_trial')` |
| `forceActive` | `(db, actor, clinicId)` | Wrapper → `setPlatformOverride('force_active')` |

### Emergency

| Function | Signature | Caller |
|----------|-----------|--------|
| `emergencyLock` | `(db, actor, clinicId, { reason })` | Platform Admin PATCH |
| `emergencyUnlock` | `(db, actor, clinicId)` | Platform Admin PATCH |

### Feature flags & limits

| Function | Signature | Caller |
|----------|-----------|--------|
| `updateFeatureFlags` | `(db, actor, clinicId, { features })` | Platform Admin PATCH |
| `setAiLimit` | `(db, actor, clinicId, { limit })` | Platform Admin PATCH |

### Payments

| Function | Signature | Caller |
|----------|-----------|--------|
| `recordManualPayment` | `(db, actor, clinicId, { date, amount, method, note })` | Platform Admin payments POST (followed by `activateSubscription`) |

### Full lifecycle (Platform Admin)

| Function | Signature | Caller |
|----------|-----------|--------|
| `applyLifecycle` | `(db, actor, clinicId, { status, reason, force })` | Platform Admin lifecycle POST |

---

## Actor conventions

```js
// Human Platform Admin action
const actor = profile // { id, email, ... }

// Automated process (no human)
const actor = SYSTEM_ACTOR // { id: null, email: 'system' }

// Automated lifecycle (cron / webhook) — engine audits with SYSTEM_ACTOR
await activateSubscription(db, clinicId, { reason: 'payment_recovered' })
await startGracePeriod(db, clinicId, { graceEnd, reason: 'payment_failed' })
await blockGraceExpired(db, clinicId)
```

---

## Who calls the engine

```
app/api/auth/signup              → createTrial
lib/create-clinic-owner          → createTrial
app/api/cron/trial-expiry        → blockExpiredTrial · blockGraceExpired · platform notifications
app/api/subscriptions/webhook    → activateSubscription · startGracePeriod · cancelSubscription
app/api/subscriptions/route.js   → activateSubscription
app/api/platform-admin/clinics/[id]/route.js       → blockClinic · unblockClinic · emergencyLock
                                                       emergencyUnlock · setTrialEndDate
                                                       setTrialEnforcement · updateFeatureFlags
                                                       setAiLimit · readState
app/api/platform-admin/clinics/[id]/subscription   → setPlatformOverride
app/api/platform-admin/clinics/[id]/lifecycle      → applyLifecycle
app/api/platform-admin/clinics/[id]/payments       → recordManualPayment · activateSubscription
lib/clinic-subscription-sync.js  → activateSubscription (backwards-compat shim)
lib/platform-notifications.js    → createPlatformNotification (called from engine + cron)
```

---

## DB collections touched

| Collection | Written by |
|------------|-----------|
| `clinics` | `blockClinic`, `unblockClinic`, `emergencyLock`, `emergencyUnlock`, `setTrialEndDate`, `setTrialEnforcement`, `setAiLimit`, `updateFeatureFlags`, `activateSubscription`, `blockExpiredTrial`, `applyLifecycle` |
| `subscriptions` | `createTrial`, `activateSubscription`, `startGracePeriod`, `cancelSubscription`, `setPlatformOverride`, `applyLifecycle`, `blockClinic`, `blockGraceExpired` |
| `clinic_manual_payments` | `recordManualPayment` |
| `platform_admin_audit_logs` | All functions that accept a non-null actor; automated transitions use `SYSTEM_ACTOR` |
| `platform_notifications` | `createPlatformNotification` (engine + cron) |

---

## Future extension points

1. **Subscription history snapshots** — add an `_writeHistory(db, clinicId, before, after)` call inside the engine to create an immutable snapshot on every mutation.
2. **Event bus** — emit a `subscription:changed` event after each write so other subsystems (notification service, analytics) can react without coupling.
3. **Idempotency keys** — accept an `idempotencyKey` option to prevent duplicate Razorpay webhook processing.
4. **Undo/replay** — because every mutation goes through one place, it's straightforward to add a dry-run mode (`{ dryRun: true }`) that returns what *would* change.
5. **Per-plan feature defaults** — `createTrial` can accept a `planFeatures` map to initialise feature flags based on the selected plan tier.

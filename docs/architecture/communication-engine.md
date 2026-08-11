# Communication Engine — Sprint 17

## Overview

Single communication layer for DentOS. All outbound patient messaging flows through `lib/communication-engine.js`. Activity events logged via Activity Engine for patient timeline visibility.

## Architecture

```
API Routes → Communication Engine → Provider Adapters (WhatsApp/SMS/Email/Push)
                ↓
         Activity Engine (timeline)
                ↓
    communication_messages / campaigns / reviews collections
```

## Collections

| Collection | Purpose |
|------------|---------|
| `communication_messages` | All messages — sent, scheduled, failed |
| `communication_campaigns` | Bulk campaign definitions |
| `communication_templates` | Custom message templates |
| `communication_reviews` | Review request tracking |

## Key Files

| File | Purpose |
|------|---------|
| `lib/communication-engine.js` | Core engine |
| `lib/communication-activity.js` | Activity logging wrapper |
| `components/communication-os/` | UI components |
| `app/api/communication/` | API routes |

## Design Rules

- No communication logic in API routes
- Best-effort logging — never break operations
- Provider adapters are swappable placeholders
- Reuses existing `sendWhatsApp` and `notifications` collection
- Segments calculated dynamically — no duplicate patient collections

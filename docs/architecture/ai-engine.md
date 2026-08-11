# AI Engine — Sprint 18

## Overview

Single orchestration layer for all AI features in DentOS. API routes delegate to `lib/ai-engine.js`.

## Constraints

- **Suggest · Draft · Recommend · Explain** — never autonomous diagnosis
- Doctor always has final control
- No AI logic in route handlers

## Architecture

```
API Routes → AI Engine → Groq / Anthropic / Gemini
                ↓
         Activity Engine (timeline)
                ↓
    ai_requests / ai_transcripts collections
```

## Key Functions

- `generateClinicalSummary()` — patient summary (reuses existing flow)
- `generateVoiceVisitSummary()` — Whisper + structured extraction
- `analyzeXray()` — Gemini X-ray analysis
- `getCopilotSnapshot()` — doctor copilot during consultation
- `getAutomationQueue()` — daily brief, labs, collections, followups
- `getAIDashboard()` / `computeAIMetrics()` — analytics

## Collections

| Collection | Purpose |
|------------|---------|
| `ai_requests` | Usage metering & activity |
| `ai_transcripts` | Voice transcription persistence |

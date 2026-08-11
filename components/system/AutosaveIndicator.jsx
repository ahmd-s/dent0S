'use client'

import { Loader2, CloudOff, Check } from 'lucide-react'

const STATUS_LABELS = {
  idle: null,
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
  offline: 'Saved locally',
}

export function AutosaveIndicator({ status, lastSavedAt }) {
  const label = STATUS_LABELS[status]
  if (!label && !lastSavedAt) return null

  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1">
      {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === 'saved' && <Check className="h-3 w-3 text-green-600" />}
      {status === 'offline' && <CloudOff className="h-3 w-3" />}
      {label}
      {lastSavedAt && status !== 'saving' && (
        <span>· {new Date(lastSavedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
      )}
    </span>
  )
}

export default AutosaveIndicator

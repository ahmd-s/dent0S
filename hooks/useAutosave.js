'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  saveDraft,
  loadDraft,
  clearDraft,
  getDraftMeta,
  createDebouncedSave,
  DEFAULT_DEBOUNCE_MS,
} from '@/lib/autosave-client'
import { fetchWithOfflineQueue, isOnline } from '@/lib/offline-sync-client'

/**
 * Unified autosave hook for notes, forms, workspace builder.
 * @param {object} opts
 * @param {string} opts.scope - AUTOSAVE_SCOPES value
 * @param {string} opts.id - Unique entity id
 * @param {*} opts.value - Current form value
 * @param {function} [opts.onSave] - Optional server save (async)
 * @param {number} [opts.debounceMs]
 * @param {boolean} [opts.enabled]
 */
export function useAutosave({
  scope,
  id,
  value,
  onSave,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  enabled = true,
}) {
  const [status, setStatus] = useState('idle') // idle | saving | saved | error | offline
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [recovered, setRecovered] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value

  // Recover draft on mount
  useEffect(() => {
    if (!scope || !id) return
    const draft = loadDraft(scope, id)
    const meta = getDraftMeta(scope, id)
    if (draft && meta) {
      setLastSavedAt(meta.savedAt)
      setRecovered(true)
    }
  }, [scope, id])

  const persist = useCallback(async (data) => {
    if (!enabled || !scope || !id) return
    setStatus('saving')
    saveDraft(scope, id, data)

    if (!isOnline()) {
      setStatus('offline')
      setLastSavedAt(new Date().toISOString())
      return
    }

    if (onSave) {
      try {
        await onSave(data)
        clearDraft(scope, id)
        setStatus('saved')
        setLastSavedAt(new Date().toISOString())
      } catch {
        setStatus('error')
      }
    } else {
      setStatus('saved')
      setLastSavedAt(new Date().toISOString())
    }
  }, [enabled, scope, id, onSave])

  const debouncedPersist = useRef(createDebouncedSave((d) => persist(d), debounceMs)).current

  useEffect(() => {
    if (!enabled || value === undefined || value === null) return
    debouncedPersist(value)
  }, [value, enabled, debouncedPersist])

  const saveNow = useCallback(async () => {
    await persist(valueRef.current)
  }, [persist])

  const recoverDraft = useCallback(() => {
    const draft = loadDraft(scope, id)
    setRecovered(false)
    return draft
  }, [scope, id])

  const dismissRecovery = useCallback(() => setRecovered(false), [])

  return {
    status,
    lastSavedAt,
    recovered,
    recoverDraft,
    dismissRecovery,
    saveNow,
    hasDraft: !!getDraftMeta(scope, id),
  }
}

export default useAutosave

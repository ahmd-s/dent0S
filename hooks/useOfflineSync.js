'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  isOnline,
  getSyncStatus,
  getOfflineQueue,
  processOfflineQueue,
  startOfflineSyncListener,
  SYNC_STATUS,
} from '@/lib/offline-sync-client'

/**
 * Hook for offline detection, queue status, and reconnect sync.
 */
export function useOfflineSync() {
  const [online, setOnline] = useState(true)
  const [syncStatus, setSyncStatusState] = useState(SYNC_STATUS.ONLINE)
  const [queueLength, setQueueLength] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(() => {
    setOnline(isOnline())
    setSyncStatusState(getSyncStatus())
    setQueueLength(getOfflineQueue().length)
  }, [])

  useEffect(() => {
    refresh()
    const cleanup = startOfflineSyncListener()

    const onStatus = () => refresh()
    window.addEventListener('online', onStatus)
    window.addEventListener('offline', onStatus)
    window.addEventListener('dentos:sync-status', onStatus)

    return () => {
      cleanup()
      window.removeEventListener('online', onStatus)
      window.removeEventListener('offline', onStatus)
      window.removeEventListener('dentos:sync-status', onStatus)
    }
  }, [refresh])

  const syncNow = useCallback(async () => {
    setSyncing(true)
    try {
      const result = await processOfflineQueue()
      refresh()
      return result
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  const readOnlyOffline = !online && queueLength > 0

  return {
    online,
    syncStatus,
    queueLength,
    syncing,
    syncNow,
    readOnlyOffline,
    isConflict: syncStatus === SYNC_STATUS.CONFLICT,
  }
}

export default useOfflineSync

'use client'

import { WifiOff, RefreshCw, CloudOff, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOfflineSync } from '@/hooks/useOfflineSync'
import { SYNC_STATUS } from '@/lib/offline-sync-client'

export function OfflineBanner() {
  const { online, syncStatus, queueLength, syncing, syncNow, readOnlyOffline, isConflict } = useOfflineSync()

  if (online && queueLength === 0 && !isConflict) return null

  const isOffline = !online || syncStatus === SYNC_STATUS.OFFLINE
  const isSyncing = syncing || syncStatus === SYNC_STATUS.SYNCING

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-lg border text-sm ${
        isConflict
          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/80 dark:border-amber-800 dark:text-amber-200'
          : isOffline
            ? 'bg-slate-800 border-slate-700 text-white'
            : 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/80 dark:border-blue-800'
      }`}
      role="status"
      aria-live="polite"
    >
      {isConflict ? (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      ) : isOffline ? (
        <WifiOff className="h-4 w-4 shrink-0" />
      ) : (
        <CloudOff className="h-4 w-4 shrink-0" />
      )}

      <span>
        {isConflict && 'Sync conflict detected — review changes before saving'}
        {isOffline && !isConflict && `You're offline${queueLength ? ` · ${queueLength} change${queueLength > 1 ? 's' : ''} queued` : ''}`}
        {readOnlyOffline && !isConflict && ' · Read-only mode'}
        {isSyncing && 'Syncing pending changes…'}
        {!isOffline && !isSyncing && !isConflict && queueLength > 0 && `${queueLength} pending change${queueLength > 1 ? 's' : ''} to sync`}
      </span>

      {(queueLength > 0 || isConflict) && online && (
        <Button
          size="sm"
          variant={isOffline ? 'secondary' : 'outline'}
          className="h-7 text-xs"
          onClick={syncNow}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync now
        </Button>
      )}
    </div>
  )
}

export default OfflineBanner

'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DeleteClinicDialog({ clinic, open, onOpenChange, onDeleted }) {
  const [step, setStep] = useState(1)
  const [typed, setTyped] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reset = () => {
    setStep(1)
    setTyped('')
    setError('')
    setLoading(false)
  }

  const close = () => {
    reset()
    onOpenChange(false)
  }

  const submit = async () => {
    if (!clinic) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/platform-admin/clinics/${clinic.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation_name: typed }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        setError(d.error || 'Delete failed')
        return
      }
      onDeleted?.(clinic.id)
      close()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  const canDelete = clinic?.is_active === false && !clinic?.deleted_at
  const nameMatches = clinic && typed.trim() === clinic.name

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) close(); else onOpenChange(true) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Permanently delete clinic
          </DialogTitle>
          <DialogDescription>
            This removes the clinic from DentOS. Login and API access stay blocked. This cannot be undone from the console.
          </DialogDescription>
        </DialogHeader>

        {!canDelete ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            Active clinics cannot be deleted. Deactivate the clinic first, then try again.
          </div>
        ) : step === 1 ? (
          <div className="space-y-3 text-sm">
            <p>You are about to permanently delete <strong>{clinic?.name}</strong>.</p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Staff will no longer be able to log in.</li>
              <li>The clinic disappears from the default directory.</li>
              <li>This action is irreversible in the Super Admin console.</li>
            </ul>
          </div>
        ) : step === 2 ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-clinic-name">Type the clinic name to continue</Label>
            <Input
              id="confirm-clinic-name"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={clinic?.name}
              autoComplete="off"
            />
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="font-medium text-destructive">Final confirmation</p>
            <p className="text-muted-foreground">
              Permanently delete <strong>{clinic?.name}</strong>? You will not be able to restore this clinic from Super Admin.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={loading}>Cancel</Button>
          {canDelete && step === 1 && (
            <Button variant="destructive" onClick={() => setStep(2)}>Continue</Button>
          )}
          {canDelete && step === 2 && (
            <Button variant="destructive" onClick={() => setStep(3)} disabled={!nameMatches}>
              Confirm name
            </Button>
          )}
          {canDelete && step === 3 && (
            <Button variant="destructive" onClick={submit} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Permanently delete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

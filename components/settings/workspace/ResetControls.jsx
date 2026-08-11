'use client'

import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { SectionPanel } from './ToggleSection'
import { RESET_SECTIONS, ROLE_LABELS } from '@/lib/workspace-ui-schema'

export default function ResetControls({
  previewRole,
  resetDialog,
  setResetDialog,
  onConfirmReset,
  resetting,
}) {
  return (
    <>
      <SectionPanel>
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Reset controls</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reset sections for {ROLE_LABELS[previewRole]} back to platform defaults. Confirmation required.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RESET_SECTIONS.filter(s => s.id !== 'all').map(section => (
              <Button
                key={section.id}
                variant="outline"
                size="sm"
                className="h-9"
                disabled={resetting}
                onClick={() => setResetDialog(section.id)}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                {section.label}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={resetting}
              onClick={() => setResetDialog('all')}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Reset Entire Workspace
            </Button>
          </div>
        </div>
      </SectionPanel>

      <AlertDialog open={!!resetDialog} onOpenChange={open => !open && setResetDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resetDialog === 'all'
                ? 'Reset entire workspace?'
                : `Reset ${RESET_SECTIONS.find(s => s.id === resetDialog)?.label || resetDialog}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {resetDialog === 'all'
                ? 'All roles will revert to platform default templates. Saved presets are kept. This cannot be undone.'
                : `The ${ROLE_LABELS[previewRole]} ${resetDialog?.replace('_', ' ')} configuration will revert to platform defaults.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onConfirmReset}
              disabled={resetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetting ? 'Resetting…' : 'Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

'use client'
import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const SPRINT_2 = 'Coming in Sprint 2'

export function SectionHeading({ title, description, actions }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PendingNotice({ children = SPRINT_2, className }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground',
        className
      )}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

export function PlaceholderCard({ label, note = SPRINT_2, icon: Icon }) {
  return (
    <Card className="border-dashed border-border/70 bg-muted/20 shadow-none">
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </div>
        <p className="text-2xl font-semibold leading-none text-muted-foreground/60">—</p>
        <p className="text-xs text-muted-foreground/80">{note}</p>
      </CardContent>
    </Card>
  )
}

'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Unified empty state for lists, dashboards, and module pages.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
  compact = false,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-12 md:py-16 px-4',
        className
      )}
      role="status"
    >
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {(actionLabel && (onAction || actionHref)) && (
        <div className="mt-4">
          {actionHref ? (
            <Button asChild className="bg-[#0D9488] hover:bg-[#0B7E73]">
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : (
            <Button onClick={onAction} className="bg-[#0D9488] hover:bg-[#0B7E73]">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default EmptyState

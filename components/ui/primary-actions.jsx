'use client'

import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * One primary action plus overflow for the rest.
 * actions: [{ id, label, onSelect, primary, destructive }]
 */
export default function PrimaryActions({ actions = [], className = '', quiet = false }) {
  const list = actions.filter(Boolean)
  if (!list.length) return null
  const primary = list.find(a => a.primary) || list[0]
  const rest = list.filter(a => a.id !== primary.id)

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Button
        size="sm"
        variant={primary.destructive ? 'destructive' : quiet ? 'outline' : 'default'}
        className="h-7 text-xs"
        onClick={e => {
          e.preventDefault()
          e.stopPropagation()
          primary.onSelect?.()
        }}
      >
        {primary.label}
      </Button>
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="More actions"
              onClick={e => { e.preventDefault(); e.stopPropagation() }}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
            {rest.map(a => (
              <DropdownMenuItem
                key={a.id}
                className={a.destructive ? 'text-red-600 focus:text-red-600' : ''}
                onSelect={() => a.onSelect?.()}
              >
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

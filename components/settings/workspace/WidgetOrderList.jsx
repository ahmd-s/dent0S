'use client'

import { GripVertical } from 'lucide-react'
import { WIDGET_LABELS } from '@/lib/workspace-ui-schema'

export default function WidgetOrderList({ order, onChange }) {
  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('text/plain', String(index))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, dropIndex) => {
    e.preventDefault()
    const dragIndex = Number(e.dataTransfer.getData('text/plain'))
    if (Number.isNaN(dragIndex) || dragIndex === dropIndex) return

    const next = [...order]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(dropIndex, 0, moved)
    onChange(next)
  }

  return (
    <div className="rounded-lg border border-border bg-card divide-y divide-border/60">
      <div className="px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">Dashboard widget order</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Drag to reorder how widgets appear on the dashboard for this role.
        </p>
      </div>
      <ul className="py-1">
        {order.map((key, index) => (
          <li
            key={key}
            draggable
            onDragStart={e => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, index)}
            className="flex items-center gap-3 px-4 py-2.5 cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-foreground flex-1">
              {WIDGET_LABELS[key] || key}
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">{index + 1}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

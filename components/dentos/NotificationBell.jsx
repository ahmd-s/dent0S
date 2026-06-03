'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, FlaskConical } from 'lucide-react'

const relTime = (d) => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24); if (days < 7) return `${days}d ago`
  return new Date(d).toLocaleDateString()
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications')
      if (!r.ok) return
      const d = await r.json()
      setItems(d.notifications || [])
      setUnread(d.unread_count || 0)
    } catch { /* silent — non-critical */ }
  }, [])

  // Poll quietly so the badge stays current without interrupting the user.
  useEffect(() => {
    load()
    const i = setInterval(load, 60000)
    return () => clearInterval(i)
  }, [load])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const markAllRead = async () => {
    if (!unread) return
    setUnread(0)
    setItems(prev => prev.map(n => ({ ...n, read: true })))
    try { await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }) } catch { /* silent */ }
  }

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) markAllRead()
  }

  const openCase = (n) => {
    setOpen(false)
    if (n.lab_case_id) router.push(`/lab-cases/${n.lab_case_id}`)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        aria-label="Lab updates"
        className="relative w-9 h-9 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 max-w-[90vw] bg-background border border-border rounded-md shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Lab Updates</span>
            <span className="text-xs text-muted-foreground">{items.length ? `${items.length} recent` : ''}</span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                No lab updates yet. Status changes from labs will appear here.
              </div>
            ) : items.map(n => (
              <button
                key={n.id}
                onClick={() => openCase(n)}
                className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted flex gap-3 ${n.read ? '' : 'bg-teal-50/60 dark:bg-teal-900/10'}`}>
                <div className="mt-0.5 w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                  <FlaskConical className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{n.case_number} · {n.patient_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Lab marked <span className="font-medium text-foreground">{n.status_label}</span>{n.lab_name ? ` · ${n.lab_name}` : ''}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{relTime(n.created_at)}</div>
                </div>
                {!n.read && <span className="mt-1 w-2 h-2 rounded-full bg-teal-500 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

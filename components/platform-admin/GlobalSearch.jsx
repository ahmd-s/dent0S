'use client'
import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CreditCard, Search, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

function HighlightedText({ text, query }) {
  if (!query || !text) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-800 rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

export function GlobalSearch() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const inputRef = useRef(null)

  const search = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const r = await fetch(`/api/platform-admin/search?q=${encodeURIComponent(query)}`)
      if (!r.ok) return
      const d = await r.json()
      setResults(d)
    } catch {
      // Non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQ(val)
    setOpen(true)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults(null); setOpen(false); return }
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const navigate = (path) => {
    setOpen(false)
    setQ('')
    setResults(null)
    router.push(path)
  }

  const totalResults = results
    ? (results.clinics?.length || 0) + (results.staff?.length || 0) + (results.subscriptions?.length || 0)
    : 0

  return (
    <Popover open={open && q.length >= 2} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={handleChange}
            placeholder="Search clinics, staff, IDs…"
            className="h-9 pl-9 text-sm"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-0" onOpenAutoFocus={e => e.preventDefault()}>
        {loading && (
          <div className="p-4 text-sm text-muted-foreground">Searching…</div>
        )}
        {!loading && results && totalResults === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No results for &ldquo;{q}&rdquo;</div>
        )}
        {!loading && results && totalResults > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {results.clinics?.length > 0 && (
              <div>
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Clinics
                </p>
                {results.clinics.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate(`/platform-admin/clinics/${c.id}`)}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        <HighlightedText text={c.name} query={q} />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.slug}{c.phone ? ` · ${c.phone}` : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {results.staff?.length > 0 && (
              <div>
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff
                </p>
                {results.staff.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate(`/platform-admin/clinics/${p.clinic_id}`)}
                  >
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        <HighlightedText text={p.full_name} query={q} />
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.email} · {p.role} · {p.clinic_name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {results.subscriptions?.length > 0 && (
              <div>
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Subscriptions
                </p>
                {results.subscriptions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
                    onClick={() => navigate(`/platform-admin/clinics/${s.clinic_id}`)}
                  >
                    <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {s.clinic_name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {s.razorpay_subscription_id || s.razorpay_customer_id || s.clinic_id}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

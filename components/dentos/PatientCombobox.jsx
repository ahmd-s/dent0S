'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

const PAGE_SIZE = 25

export function patientLabel(p) {
  if (!p) return ''
  const code = p.patient_code ? ` (${p.patient_code})` : ''
  const phone = p.phone ? ` · ${p.phone}` : ''
  return `${p.name}${code}${phone}`
}

/**
 * Patient picker backed by the server's search endpoint.
 *
 * The pickers this replaces called `/api/patients` with no parameters. That
 * endpoint defaults to `page_size=20`, so the dropdown silently held only the
 * 20 most recent patients and filtered those client-side — a clinic with more
 * than 20 patients could not select most of them. Searching server-side both
 * fixes that and keeps the payload small regardless of clinic size.
 */
export default function PatientCombobox({
  value,
  onChange,
  placeholder = 'Select patient…',
  emptyText = 'No patients found',
  disabled = false,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const requestRef = useRef(0)

  const debouncedQuery = useDebouncedValue(query, 250)

  const search = useCallback(async (q) => {
    const requestId = ++requestRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: '1', page_size: String(PAGE_SIZE) })
      if (q) params.set('q', q)
      const r = await fetch(`/api/patients?${params}`)
      const d = await r.json()
      // Ignore a response that a newer keystroke has already superseded.
      if (requestId !== requestRef.current) return
      setResults(d.patients || [])
    } catch {
      if (requestId === requestRef.current) setResults([])
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    search(debouncedQuery)
  }, [open, debouncedQuery, search])

  // Resolve the label for a preselected id that isn't in the current results.
  useEffect(() => {
    if (!value) { setSelected(null); return }
    if (selected?.id === value) return
    const inResults = results.find(p => p.id === value)
    if (inResults) { setSelected(inResults); return }
    let ignore = false
    fetch(`/api/patients/${value}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!ignore && d?.patient) setSelected(d.patient) })
      .catch(() => {})
    return () => { ignore = true }
  }, [value, results, selected])

  const triggerLabel = useMemo(
    () => (selected ? patientLabel(selected) : placeholder),
    [selected, placeholder]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground')}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Filtering happens on the server, so cmdk's local matching is off. */}
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, phone, or code…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Searching" />
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {results.map(p => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        onChange(p.id)
                        setSelected(p)
                        setOpen(false)
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === p.id ? 'opacity-100' : 'opacity-0')} aria-hidden />
                      <span className="truncate">{patientLabel(p)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

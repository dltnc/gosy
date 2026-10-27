'use client'

import { Building2, Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'

import { SUGGEST_MIN_QUERY, normalizeSuggestQuery, type Suggestion } from '@/lib/search/suggestions'
import { cn } from '@/lib/utils'

/**
 * Live destination and property lookup for the search widget.
 *
 * Realtime in the sense that matters here: every keystroke past the length gate asks the server and
 * the answer is uncached on the wire, so a stay approved a minute ago is findable. What keeps that
 * affordable is a debounce, a per-query cache for the life of the widget, and an `AbortController`
 * so an earlier keystroke's answer can never land on top of a later one's.
 *
 * The field stays a plain text input rather than a strict picker: a guest can type a city with no
 * match and still submit, which is what the form did before this existed.
 */

const DEBOUNCE_MS = 180

export interface DestinationTypeaheadProps {
  value: string
  onValueChange: (value: string) => void
  /** Fires on click or Enter. The parent decides where a row goes; this component only closes. */
  onSelect: (suggestion: Suggestion) => void
  /** Narrows results to the tab the guest is on, so the list matches where Search would take them. */
  propertyType: string
  inputId: string
  inputClassName?: string
  placeholder?: string
}

export function DestinationTypeahead({
  value,
  onValueChange,
  onSelect,
  propertyType,
  inputId,
  inputClassName,
  placeholder = 'Where are you going?',
}: DestinationTypeaheadProps) {
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const cache = useRef(new Map<string, Suggestion[]>())
  const listboxId = `${useId()}-suggestions`
  const optionId = (index: number) => `${listboxId}-option-${index}`

  const query = normalizeSuggestQuery(value)
  const cacheKey = `${propertyType}|${query.toLowerCase()}`

  useEffect(() => {
    if (!query) {
      setItems([])
      setLoading(false)
      return
    }

    // Nothing on screen to fill, so nothing worth asking for — picking a destination writes the city
    // back into this field, and that write should not cost a request.
    if (!open) return

    const cached = cache.current.get(cacheKey)
    if (cached) {
      setItems(cached)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)

    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: query, type: propertyType })
      fetch(`/api/suggest?${params.toString()}`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error(`suggest responded ${response.status}`)
          return response.json() as Promise<{ suggestions?: Suggestion[] }>
        })
        .then((data) => {
          const next = data.suggestions ?? []
          cache.current.set(cacheKey, next)
          setItems(next)
          setLoading(false)
          setActive(-1)
        })
        .catch(() => {
          // Rate limited, offline, or superseded: an empty list and the plain input the guest was
          // already typing into. Never a blocking error — they can still press Search.
          if (controller.signal.aborted) return
          setItems([])
          setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [cacheKey, open, propertyType, query])

  function choose(suggestion: Suggestion) {
    setOpen(false)
    setActive(-1)
    onSelect(suggestion)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      setActive(-1)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (items.length === 0) return
      event.preventDefault()
      setOpen(true)
      // Wrapping through -1 means arrowing past either end hands the guest back what they typed.
      const next = active + (event.key === 'ArrowDown' ? 1 : -1)
      setActive(next >= items.length ? -1 : next < -1 ? items.length - 1 : next)
      return
    }

    if (event.key === 'Enter' && open && active >= 0 && items[active]) {
      // Without this the form submits the typed text and discards the highlighted row.
      event.preventDefault()
      choose(items[active])
    }
  }

  const showList = open && value.trim().length > 0
  /** The listbox element itself only exists with rows in it, which is what `aria-expanded` reports. */
  const listVisible = showList && items.length > 0
  const status = !showList || !query
    ? ''
    : loading
      ? 'Searching'
      : items.length > 0
        ? `${items.length} suggestion${items.length === 1 ? '' : 's'} available`
        : 'No suggestions'

  function renderBody() {
    if (query.length === 0) {
      return (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Keep typing — {SUGGEST_MIN_QUERY} letters is enough.
        </p>
      )
    }

    if (items.length === 0) {
      return loading ? (
        <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Searching…
        </p>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          Nothing matched “{value.trim()}”. You can still search for it.
        </p>
      )
    }

    return (
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Destinations and stays"
        className="max-h-72 overflow-y-auto py-1"
      >
        {items.map((suggestion, index) => (
          <li
            key={suggestion.id}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            onClick={() => choose(suggestion)}
            onMouseEnter={() => setActive(index)}
            className={cn(
              'flex cursor-pointer items-center gap-3 px-4 py-2.5',
              index === active && 'bg-surface-container-low',
            )}
          >
            {renderRow(suggestion)}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <input
        id={inputId}
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        // Safe to close on blur: rows are not focusable and the list swallows mousedown, so focus
        // never leaves this input while the guest is picking one.
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={listVisible}
        aria-controls={listVisible ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        className={inputClassName}
      />

      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>

      {showList ? (
        <div
          // Keeping focus in the input on mousedown is what lets a click reach the row's onClick
          // instead of being cancelled by the blur that focus loss would trigger.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-30 mt-2 overflow-hidden rounded-lg border border-border bg-white text-left shadow-float"
        >
          {renderBody()}
        </div>
      ) : null}
    </>
  )
}

/** The row itself, kept out of the list body so the markup for both kinds sits side by side. */
function renderRow(suggestion: Suggestion) {
  const Icon = suggestion.kind === 'property' ? Building2 : MapPin

  return (
    <>
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-foreground">{suggestion.label}</span>
        {suggestion.sublabel ? (
          <span className="block truncate text-sm text-muted-foreground">
            {suggestion.sublabel}
          </span>
        ) : null}
      </span>
      {suggestion.kind === 'property' ? (
        <span className="text-label-md shrink-0 uppercase text-outline">Stay</span>
      ) : null}
    </>
  )
}

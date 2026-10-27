'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CalendarDays, MapPin, Search, Users } from 'lucide-react'

import { DestinationTypeahead } from '@/features/search/components/destination-typeahead'
import { Button } from '@/components/ui/button'
import { type Suggestion, suggestionHref } from '@/lib/search/suggestions'
import { cn } from '@/lib/utils'

const PROPERTY_TYPES = [
  { value: 'hotel', label: 'Hotels', path: '/hotels-in' },
  { value: 'resort', label: 'Resorts', path: '/resorts-in' },
] as const

type PropertyTypeValue = (typeof PROPERTY_TYPES)[number]['value']

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return d.toISOString().slice(0, 10)
}

const fieldCell =
  'group flex items-center gap-3 border-border px-4 py-3 transition-colors focus-within:bg-surface-container-low max-md:border-b max-md:last:border-b-0 md:border-r md:last:border-r-0 md:focus-within:ring-2 md:focus-within:ring-primary/20'

const fieldLabel =
  'text-label-md uppercase text-outline'

const fieldInput =
  'w-full border-none p-0 font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground focus:outline-none'

const fieldIcon =
  'size-5 shrink-0 text-primary transition-colors group-focus-within:text-secondary'

/**
 * No `overflow-hidden` here on purpose — it would clip the typeahead's dropdown. Nothing needs
 * clipping to keep the rounded corners clean: on desktop the form's own padding insets every cell,
 * and on mobile the cells that touch a corner have no background of their own.
 */
const formShell =
  'relative grid w-full grid-cols-1 rounded-xl bg-white shadow-float md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] md:items-center md:p-2'

export function SearchBar({
  initialCity = '',
  initialPropertyType = 'hotel',
  submitLabel = 'Search',
}: {
  initialCity?: string
  initialPropertyType?: PropertyTypeValue
  submitLabel?: string
}) {
  const router = useRouter()
  const [propertyType, setPropertyType] = useState<PropertyTypeValue>(initialPropertyType)
  const [city, setCity] = useState(initialCity)
  const [checkIn, setCheckIn] = useState(todayPlus(1))
  const [checkOut, setCheckOut] = useState(todayPlus(3))
  const [adults, setAdults] = useState(2)

  const basePath = PROPERTY_TYPES.find((type) => type.value === propertyType)?.path ?? '/hotels-in'

  function stayParams(): URLSearchParams {
    const params = new URLSearchParams()
    if (checkIn) params.set('checkIn', checkIn)
    if (checkOut) params.set('checkOut', checkOut)
    params.set('adults', String(adults))
    return params
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!city.trim()) return

    router.push(`${basePath}/${encodeURIComponent(city.trim())}?${stayParams().toString()}`)
  }

  /**
   * A picked stay goes straight to its own page — that is the point of searching by name — while a
   * picked destination only fills the field, leaving the guest free to set dates before searching.
   */
  function handleSuggestion(suggestion: Suggestion) {
    if (suggestion.kind === 'property') {
      router.push(suggestionHref(suggestion, { basePath, params: stayParams() }))
      return
    }
    setCity(suggestion.city)
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Property search"
      className={formShell}
    >
      <div className="col-span-1 flex items-center gap-1 border-b border-border px-4 py-2 md:col-span-full">
        {PROPERTY_TYPES.map((type) => (
          <button
            key={type.value}
            type="button"
            onClick={() => setPropertyType(type.value)}
            aria-pressed={propertyType === type.value}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-semibold transition-colors',
              propertyType === type.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-surface-container-low hover:text-foreground',
            )}
          >
            {type.label}
          </button>
        ))}
      </div>
      <div className={cn(fieldCell, 'rounded-l-none')}>
        <MapPin className={fieldIcon} aria-hidden />
        <div className="relative flex flex-1 flex-col gap-0.5">
          <label htmlFor="search-city" className={fieldLabel}>
            Location
          </label>
          <DestinationTypeahead
            inputId="search-city"
            value={city}
            onValueChange={setCity}
            onSelect={handleSuggestion}
            propertyType={propertyType}
            inputClassName={fieldInput}
          />
        </div>
      </div>

      <div className={fieldCell}>
        <CalendarDays className={fieldIcon} aria-hidden />
        <div className="flex flex-1 flex-col gap-0.5">
          <label htmlFor="search-check-in" className={fieldLabel}>
            Check-in
          </label>
          <input
            id="search-check-in"
            type="date"
            min={todayPlus(0)}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value)
              if (e.target.value && e.target.value >= checkOut) {
                const next = new Date(new Date(e.target.value).getTime() + 86_400_000)
                setCheckOut(next.toISOString().slice(0, 10))
              }
            }}
            className={cn(fieldInput, '[color-scheme:light]')}
          />
        </div>
      </div>

      <div className={fieldCell}>
        <CalendarDays className={fieldIcon} aria-hidden />
        <div className="flex flex-1 flex-col gap-0.5">
          <label htmlFor="search-check-out" className={fieldLabel}>
            Check-out
          </label>
          <input
            id="search-check-out"
            type="date"
            min={
              checkIn
                ? new Date(new Date(checkIn).getTime() + 86_400_000).toISOString().slice(0, 10)
                : todayPlus(1)
            }
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className={cn(fieldInput, '[color-scheme:light]')}
          />
        </div>
      </div>

      <div className={fieldCell}>
        <Users className={fieldIcon} aria-hidden />
        <div className="flex flex-1 flex-col gap-0.5">
          <label htmlFor="search-adults" className={fieldLabel}>
            Guests
          </label>
          <select
            id="search-adults"
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className={cn(fieldInput, 'cursor-pointer appearance-none bg-transparent')}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'adult' : 'adults'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-2 max-md:p-4 max-md:pt-0">
        <Button
          type="submit"
          variant="cta"
          size="lg"
          className="w-full md:w-auto md:px-8"
        >
          <Search className="size-5" />
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

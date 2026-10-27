'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Map as MapIcon, MapPin, Star } from 'lucide-react'

import type { ListingSearch } from '@/lib/search-params/listing'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const PRICE_CEILING = 50000

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
]

interface FiltersPanelProps {
  filters: ListingSearch
  amenities: { id: string; label: string }[]
}

export function FiltersPanel({ filters, amenities }: FiltersPanelProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const update = useCallback(
    (patch: Partial<Record<keyof ListingSearch, unknown>>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (
          value == null ||
          value === '' ||
          (Array.isArray(value) && value.length === 0) ||
          value === false
        ) {
          next.delete(key)
        } else if (Array.isArray(value)) {
          next.set(key, value.join(','))
        } else {
          next.set(key, String(value))
        }
      }
      next.delete('page')
      router.replace(`?${next.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const setStars = (value: number) => {
    update({ stars: filters.stars === value ? null : value })
  }

  const toggleAmenity = (id: string) => {
    const set = new Set(filters.amenities)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    update({ amenities: [...set] })
  }

  const isMapView = searchParams.get('view') === 'map'
  const mapToggleHref = (() => {
    const next = new URLSearchParams(searchParams.toString())
    if (isMapView) next.delete('view')
    else next.set('view', 'map')
    next.delete('page')
    return `?${next.toString()}`
  })()

  return (
    <aside className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs font-semibold text-secondary hover:text-secondary"
              onClick={() => router.replace('?', { scroll: false })}
            >
              Clear all
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary-container via-surface-container-high to-primary-fixed">
            <div className="flex h-24 items-center justify-center">
              <MapPin className="size-6 text-primary/70" aria-hidden />
            </div>
            <Button asChild size="sm" className="absolute bottom-2 left-1/2 h-8 -translate-x-1/2">
              <a href={mapToggleHref}>
                <MapIcon className="size-4" aria-hidden />
                {isMapView ? 'Show list' : 'Show map'}
              </a>
            </Button>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label className="text-sm font-medium">Price Range per night</Label>
            <Slider
              min={0}
              max={PRICE_CEILING}
              step={500}
              value={[filters.priceMax ?? PRICE_CEILING]}
              onValueCommit={(values) => {
                const max = values[0]
                update({ priceMax: max >= PRICE_CEILING ? null : max })
              }}
              className="[&_[data-slot=slider-range]]:bg-secondary"
            />
            <div className="flex items-center justify-between">
              <Badge variant="muted" className="rounded-md font-semibold">
                ৳0
              </Badge>
              <Badge variant="muted" className="rounded-md font-semibold">
                {(filters.priceMax ?? PRICE_CEILING) >= PRICE_CEILING
                  ? `৳${PRICE_CEILING.toLocaleString('en-US')}+`
                  : `৳${(filters.priceMax ?? PRICE_CEILING).toLocaleString('en-US')}`}
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium">Star Rating</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value}+ stars`}
                  aria-pressed={(filters.stars ?? 0) >= value}
                  onClick={() => setStars(value)}
                  className="rounded p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={cn(
                      'size-5',
                      (filters.stars ?? 0) >= value
                        ? 'fill-amber-400 text-amber-400'
                        : 'fill-muted text-muted-foreground/40',
                    )}
                    aria-hidden
                  />
                </button>
              ))}
              {filters.stars != null ? (
                <span className="ml-1 text-xs text-muted-foreground">{filters.stars}+</span>
              ) : null}
            </div>
          </div>

          {amenities.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Popular Amenities</Label>
                <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto">
                  {amenities.slice(0, 8).map((amenity) => (
                    <label
                      key={amenity.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={filters.amenities.includes(amenity.id)}
                        onCheckedChange={() => toggleAmenity(amenity.id)}
                      />
                      {amenity.label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  )
}

export { SORT_OPTIONS }

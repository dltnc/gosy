'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, LayoutGrid } from 'lucide-react'
import { useListingResults } from '../hooks/use-listing-results'
import { PropertyCard } from './property-card'
import { ResultsMap } from './results-map'
import { SponsoredSpotlight } from './sponsored-spotlight'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

interface ResultsSectionProps {
  city: string
  title: string
  propertyType: 'hotel' | 'resort'
  initialData?: Awaited<ReturnType<typeof import('@/lib/search/searchProperties').searchProperties>>
}

function pageList(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)

  const list: (number | '…')[] = []
  let previous = 0
  for (const current of sorted) {
    if (current - previous > 1) list.push('…')
    list.push(current)
    previous = current
  }
  return list
}

export function ResultsSection({ city, title, propertyType, initialData }: ResultsSectionProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get('view') === 'map' ? 'map' : 'list'

  // The map/list toggle must not invalidate the results query.
  const searchForQuery = (() => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('view')
    return next.toString()
  })()

  const { data, isPending, isError, error, isFetching, isPlaceholderData } = useListingResults(
    city,
    searchForQuery,
    propertyType,
    initialData,
  )

  const wishlistedIds = useMemo(() => new Set(data?.wishlistedPropertyIds ?? []), [data])

  function patchParams(mutate: (params: URLSearchParams) => void, scroll: boolean) {
    const params = new URLSearchParams(searchParams.toString())
    mutate(params)
    router.replace(`?${params.toString()}`, { scroll })
  }

  function setView(next: 'list' | 'map') {
    patchParams((params) => {
      if (next === 'map') params.set('view', 'map')
      else params.delete('view')
    }, false)
  }

  function setSort(value: string) {
    patchParams((params) => {
      if (value === 'relevance') params.delete('sort')
      else params.set('sort', value)
      params.delete('page')
    }, false)
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(searchForQuery)
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    if (view === 'map') next.set('view', 'map')
    router.push(`?${next.toString()}`, { scroll: true })
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {(error as Error).message ?? 'Something went wrong.'}
      </div>
    )
  }

  const results = data?.results ?? []
  const spotlight = data?.spotlight ?? []
  // Promoted listings are already spliced out of `results`, so the map has to be given both or the
  // sponsored pins would simply be missing from it.
  const mapResults = spotlight.length > 0 ? [...spotlight, ...results] : results
  const isEmpty = results.length === 0 && spotlight.length === 0

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>

        <div className="flex items-center gap-3">
          {view === 'map' ? (
            <Button variant="outline" size="sm" onClick={() => setView('list')}>
              <LayoutGrid className="size-4" /> Show list
            </Button>
          ) : null}

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">Sort By:</span>
            <Select value={searchParams.get('sort') ?? 'relevance'} onValueChange={setSort}>
              <SelectTrigger size="sm" className="w-[170px] bg-card font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Recommended</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
                <SelectItem value="rating">Top rated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No properties match your filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try widening your dates or removing some filters.
          </p>
        </div>
      ) : view === 'map' ? (
        <ResultsMap results={mapResults} />
      ) : (
        <div
          className={`space-y-6 transition-opacity ${
            isPlaceholderData && isFetching ? 'opacity-60' : ''
          }`}
        >
          <SponsoredSpotlight properties={spotlight} wishlistedIds={wishlistedIds} />

          <div
            className={`grid grid-cols-1 gap-5 md:grid-cols-2 ${
              isPlaceholderData && !isFetching ? 'opacity-60' : ''
            }`}
          >
            {results.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                wishlisted={wishlistedIds.has(Number(property.id))}
              />
            ))}
          </div>
        </div>
      )}

      {data && data.totalPages > 1 && view === 'list' ? (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 pt-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={!data.hasPreviousPage || isPlaceholderData}
            onClick={() => goToPage(data.page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          {pageList(data.page, data.totalPages).map((entry, index) =>
            entry === '…' ? (
              <span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={entry}
                type="button"
                onClick={() => goToPage(entry)}
                aria-current={entry === data.page ? 'page' : undefined}
                className={`inline-flex size-9 items-center justify-center rounded-md border text-sm font-semibold transition-colors ${
                  entry === data.page
                    ? 'border-secondary bg-secondary text-white'
                    : 'border-border bg-card text-foreground hover:bg-accent'
                }`}
              >
                {entry}
              </button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={!data.hasNextPage || isPlaceholderData}
            onClick={() => goToPage(data.page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      ) : null}

      {isFetching && !isPending ? (
        <Loader2 className="mx-auto size-4 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
    </section>
  )
}

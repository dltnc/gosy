'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import type { SearchResult } from '@/lib/search/searchProperties'

export function useListingResults(
  city: string,
  search: string,
  propertyType: 'hotel' | 'resort',
  initialData?: SearchResult,
) {
  return useQuery({
    queryKey: ['listing', propertyType, city, search],
    queryFn: async (): Promise<SearchResult> => {
      const params = new URLSearchParams(search)
      params.set('city', decodeURIComponent(city))
      params.set('type', propertyType)
      const res = await fetch(`/api/search?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Unable to load stays right now.')
      }
      return res.json()
    },
    placeholderData: keepPreviousData,
    ...(initialData ? { initialData } : {}),
  })
}

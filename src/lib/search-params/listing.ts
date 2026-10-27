import { z } from 'zod'

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const listingSearchSchema = z.object({
  q: z.string().trim().optional(),
  checkIn: dateOnly.optional(),
  checkOut: dateOnly.optional(),
  adults: z.coerce.number().int().min(1).max(16).default(2),
  children: z.coerce.number().int().min(0).max(10).default(0),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  amenities: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    ),
  tier: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return []
      return v
        .split(',')
        .map((s) => s.trim())
        .filter((s) => ['budget', 'standard', 'premium', 'flagship'].includes(s))
    }),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating']).default('relevance'),
  view: z.enum(['list', 'map']).default('list'),
  page: z.coerce.number().int().min(1).default(1),
})

export type ListingSearch = z.infer<typeof listingSearchSchema>

export function parseListingSearch(raw: Record<string, string | string[] | undefined>):
  | { ok: true; data: ListingSearch }
  | { ok: false; error: string } {
  const flat: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single != null && single !== '') flat[key] = single
  }

  const parsed = listingSearchSchema.safeParse(flat)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid filters.' }
  }

  if (parsed.data.checkIn && parsed.data.checkOut) {
    if (new Date(parsed.data.checkOut) <= new Date(parsed.data.checkIn)) {
      return { ok: false, error: 'Check-out must be after check-in.' }
    }
  } else if (parsed.data.checkIn && !parsed.data.checkOut) {
    return { ok: false, error: 'Check-out is required when check-in is set.' }
  }

  return { ok: true, data: parsed.data }
}

export function listingSearchParams(data: ListingSearch): URLSearchParams {
  const params = new URLSearchParams()

  if (data.q) params.set('q', data.q)
  if (data.checkIn) params.set('checkIn', data.checkIn)
  if (data.checkOut) params.set('checkOut', data.checkOut)
  if (data.adults !== 2) params.set('adults', String(data.adults))
  if (data.children !== 0) params.set('children', String(data.children))
  if (data.priceMin != null) params.set('priceMin', String(data.priceMin))
  if (data.priceMax != null) params.set('priceMax', String(data.priceMax))
  if (data.amenities.length) params.set('amenities', data.amenities.join(','))
  if (data.tier.length) params.set('tier', data.tier.join(','))
  if (data.stars != null) params.set('stars', String(data.stars))
  if (data.sort !== 'relevance') params.set('sort', data.sort)
  if (data.view !== 'list') params.set('view', data.view)
  if (data.page > 1) params.set('page', String(data.page))

  return params
}

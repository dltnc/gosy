import type { Endpoint } from 'payload'
import { APIError } from 'payload'
import { parseSearchParams, searchProperties } from '../lib/search/searchProperties'
import { getWishlistedPropertyIds } from '../lib/wishlist'
import { enforceRateLimit, getClientIp } from '../lib/rateLimit'

export const searchEndpoint: Endpoint = {
  path: '/search',
  method: 'get',
  handler: async (req) => {
    const ip = getClientIp(req)
    if (ip) {
      await enforceRateLimit({
        key: `rl:search:${ip}`,
        limit: 60,
        windowSeconds: 60,
        message: 'Search rate limit exceeded. Please slow down.',
      })
    }

    const url = new URL(req.url ?? 'http://localhost/')
    const params = parseSearchParams(url.searchParams)

    if (params.sort === 'distance' && (params.lat == null || params.lng == null)) {
      throw new APIError('lat and lng are required when sort=distance.', 400)
    }

    const result = await searchProperties(req.payload, params)

    if (req.user) {
      try {
        const wishlisted = await getWishlistedPropertyIds(req.payload, req.user.id)
        result.wishlistedPropertyIds = [...wishlisted]
      } catch {
        // results are still valid without wishlist annotations
      }
    }

    return Response.json(result)
  },
}

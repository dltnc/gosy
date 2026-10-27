import type { Endpoint } from 'payload'

import { enforceRateLimit, getClientIp } from '../lib/rateLimit'
import { parseTypeParam } from '../lib/search/searchProperties'
import { suggestSearch } from '../lib/search/suggestSearch'
import { normalizeSuggestQuery } from '../lib/search/suggestions'

/**
 * Typeahead for the search widget.
 *
 * Split from `/api/search` rather than folded into it: this one returns names and slugs only, skips
 * pricing and the availability join entirely, and so answers in a single query — which is what makes
 * it safe to call while the guest is still typing.
 *
 * The rate limit is far looser than search's 60/minute because a debounced typeahead legitimately
 * fires several times per search, but it is still a limit: the endpoint is unauthenticated and hits
 * the database on every call when Typesense is not configured.
 */
export const suggestEndpoint: Endpoint = {
  path: '/suggest',
  method: 'get',
  handler: async (req) => {
    const ip = getClientIp(req)
    if (ip) {
      await enforceRateLimit({
        key: `rl:suggest:${ip}`,
        limit: 300,
        windowSeconds: 60,
        message: 'Too many suggestion requests. Please slow down.',
      })
    }

    const url = new URL(req.url ?? 'http://localhost/')
    const q = normalizeSuggestQuery(url.searchParams.get('q'))
    const type = parseTypeParam(url.searchParams.get('type'))

    // Too short to be selective — answered without touching a backend so the client can stay simple
    // and just ask on every keystroke it decides to send.
    if (!q) return Response.json({ query: '', suggestions: [] })

    const suggestions = await suggestSearch(req.payload, { q, type })

    return Response.json(
      { query: q, suggestions },
      // Realtime by default: a newly approved property should appear as soon as it is approved, and
      // the client already caches per query for the life of the widget.
      { headers: { 'Cache-Control': 'no-store' } },
    )
  },
}

import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'

import { normalizeRequestedItems } from '../lib/bookings/lineItems'
import { buildQuote } from '../lib/pricing/quote'
import { enforceRateLimit, getClientIp } from '../lib/rateLimit'

interface QuoteBody {
  items?: { roomTypeId?: number | string; quantity?: number }[]
  roomTypeId?: number | string
  quantity?: number
  checkInDate?: string
  checkOutDate?: string
  adults?: number
  children?: number
  couponCode?: string
  pointsRedeemed?: number
}

/**
 * `POST /api/pricing/quote` — what a selection would cost, before anything is booked.
 *
 * Open to guests who are not signed in, because the booking widget prices a stay long before the login
 * step. Coupon and points evaluation simply narrow when there is no user: points need an account, and
 * per-user coupon limits are only checked once one exists.
 */
export const pricingQuoteEndpoint: Endpoint = {
  path: '/pricing/quote',
  method: 'post',
  handler: async (req) => {
    const ip = getClientIp(req)
    if (ip) {
      await enforceRateLimit({
        key: `rl:pricing-quote:${ip}`,
        limit: 60,
        windowSeconds: 60,
        message: 'Too many pricing requests. Please wait a moment.',
      })
    }

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as QuoteBody

    if (!body.checkInDate || !body.checkOutDate) {
      throw new APIError('checkInDate and checkOutDate are required.', 400)
    }

    const items = normalizeRequestedItems(
      body.items ??
        (body.roomTypeId != null
          ? [{ roomTypeId: body.roomTypeId, quantity: body.quantity ?? 1 }]
          : []),
    )
    if (items.length === 0) {
      throw new APIError('Select at least one room to price.', 400)
    }

    const quote = await buildQuote(req.payload, {
      items,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      adults: body.adults,
      children: body.children,
      couponCode: body.couponCode ?? null,
      pointsRedeemed: body.pointsRedeemed ?? 0,
      guestId: req.user?.id ?? null,
    })

    return Response.json(quote)
  },
}

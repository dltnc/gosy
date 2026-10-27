import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'

import { normalizeRequestedItems } from '../lib/bookings/lineItems'
import { buildQuote } from '../lib/pricing/quote'
import { enforceRateLimit, getClientIp } from '../lib/rateLimit'

interface ApplyBody {
  couponCode?: string
  /** Preferred shape, so a coupon is tested against the same subtotal the booking will charge. */
  items?: { roomTypeId?: number | string; quantity?: number }[]
  roomTypeId?: number
  checkInDate?: string
  checkOutDate?: string
  pointsRedeemed?: number
}

/**
 * `POST /api/coupons/apply` — validate a code against a specific stay.
 *
 * This used to price the stay itself from a single `roomTypeId` and `basePrice`, which meant a
 * multi-room selection was tested against the cost of one room and a minimum-spend coupon could pass
 * here and then fail at checkout. It now delegates to the same quote the widget uses.
 */
export const couponsApplyEndpoint: Endpoint = {
  path: '/apply',
  method: 'post',
  handler: async (req) => {
    const ip = getClientIp(req)
    if (ip) {
      await enforceRateLimit({
        key: `rl:coupon-apply:${ip}`,
        limit: 10,
        windowSeconds: 60,
        message: 'Too many coupon attempts. Please wait a minute.',
      })
    }

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as ApplyBody

    const items = normalizeRequestedItems(
      body.items ?? (body.roomTypeId != null ? [{ roomTypeId: body.roomTypeId, quantity: 1 }] : []),
    )

    if (!body.couponCode || items.length === 0 || !body.checkInDate || !body.checkOutDate) {
      throw new APIError(
        'couponCode, at least one room, checkInDate and checkOutDate are required.',
        400,
      )
    }

    const quote = await buildQuote(req.payload, {
      items,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      couponCode: body.couponCode,
      pointsRedeemed: body.pointsRedeemed ?? 0,
      guestId: req.user?.id ?? null,
    })

    const coupon = quote.coupon
    if (!coupon || !coupon.valid) {
      return Response.json({
        valid: false,
        reason: coupon?.reason ?? 'This coupon cannot be applied.',
      })
    }

    return Response.json({
      valid: true,
      discountAmount: quote.pricing.couponDiscountAmount,
      subtotal: quote.pricing.subtotal,
      finalSubtotal: Math.max(quote.pricing.subtotal - quote.pricing.couponDiscountAmount, 0),
      totalAmount: quote.pricing.totalAmount,
      nights: quote.nights,
      currency: quote.currency,
    })
  },
}

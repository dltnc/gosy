import type { Payload } from 'payload'
import { APIError } from 'payload'

import {
  findFreeRoomsByType,
  MAX_ROOMS_PER_BOOKING,
  type RequestedItem,
} from '../bookings/lineItems'
import { evaluateCouponCode, type CouponEvaluation } from '../coupons/evaluateCoupon'
import { validateRedemption } from '../loyalty/validateRedemption'
import { computeNights, computePricing, type PricingResult } from './computePricing'

/**
 * Server-side price for a room selection that has not been booked yet.
 *
 * The booking widget used to price stays in the browser, which meant two implementations of the same
 * arithmetic and a total that could disagree with the one the checkout charged. This module is the
 * single answer: it reads live rates, live availability, the coupon rules and the loyalty caps, and
 * returns exactly the numbers `computePricing` will produce at checkout.
 *
 * Unlike `allocateRooms`, a quote never throws for a sold-out selection. The widget needs to *show*
 * that only two rooms are left, so shortfalls come back as per-line `available` counts and an
 * `issues` list; only malformed requests are errors.
 */

export interface QuoteRequest {
  items: RequestedItem[]
  checkInDate: string | Date
  checkOutDate: string | Date
  adults?: number
  children?: number
  couponCode?: string | null
  pointsRedeemed?: number
  guestId?: number | string | null
}

export interface QuoteLine {
  roomTypeId: number
  name: string
  quantity: number
  nightlyRate: number
  nights: number
  lineSubtotal: number
  /** Rooms of this type free for the whole stay, ignoring what this quote asks for. */
  available: number
  maxOccupancy: number
}

export interface Quote {
  propertyId: number
  currency: string
  nights: number
  rooms: number
  lines: QuoteLine[]
  pricing: PricingResult
  coupon: CouponEvaluation | null
  points: { requested: number; applied: number; discountAmount: number; reason?: string }
  capacity: { guests: number; maxGuests: number; fits: boolean }
  /** Empty when the selection can be booked as asked. */
  issues: string[]
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export async function buildQuote(payload: Payload, request: QuoteRequest): Promise<Quote> {
  const items = request.items
  if (items.length === 0) throw new APIError('Select at least one room to price.', 400)

  const rooms = items.reduce((sum, item) => sum + item.quantity, 0)
  if (rooms > MAX_ROOMS_PER_BOOKING) {
    throw new APIError(`A single booking can hold at most ${MAX_ROOMS_PER_BOOKING} rooms.`, 400)
  }

  const nights = computeNights(request.checkInDate, request.checkOutDate)
  if (nights < 1) throw new APIError('Check-out must be at least one night after check-in.', 400)

  const roomTypeIds = items.map((item) => item.roomTypeId)
  const { docs: roomTypes } = await payload.find({
    collection: 'room-types',
    where: { id: { in: roomTypeIds } },
    limit: roomTypeIds.length,
    depth: 0,
    overrideAccess: true,
  })

  const byId = new Map(roomTypes.map((roomType) => [String(roomType.id), roomType]))
  const free = await findFreeRoomsByType(payload, {
    roomTypeIds,
    checkInDate: request.checkInDate,
    checkOutDate: request.checkOutDate,
  })

  const issues: string[] = []
  const lines: QuoteLine[] = []
  let propertyId: number | null = null

  for (const item of items) {
    const roomType = byId.get(String(item.roomTypeId))
    if (!roomType) throw new APIError('One of the selected room types no longer exists.', 400)

    const itemPropertyId = Number(
      typeof roomType.property === 'object' ? roomType.property?.id : roomType.property,
    )
    if (propertyId != null && propertyId !== itemPropertyId) {
      throw new APIError('All rooms in one booking must belong to the same property.', 400)
    }
    propertyId = itemPropertyId

    const available = (free.get(String(item.roomTypeId)) ?? []).length
    if (!roomType.isActive) {
      issues.push(`"${roomType.name}" is not currently bookable.`)
    } else if (available < item.quantity) {
      issues.push(
        available === 0
          ? `"${roomType.name}" is not available for these dates.`
          : `Only ${available} "${roomType.name}" ${available === 1 ? 'room is' : 'rooms are'} left for these dates.`,
      )
    }

    const nightlyRate = roomType.basePrice ?? 0
    lines.push({
      roomTypeId: Number(roomType.id),
      name: roomType.name,
      quantity: item.quantity,
      nightlyRate,
      nights,
      lineSubtotal: round(nightlyRate * nights * item.quantity),
      available,
      maxOccupancy: roomType.maxOccupancy ?? 0,
    })
  }

  if (propertyId == null) throw new APIError('The selected rooms have no property.', 400)

  // One rate per physical room, matching what the booking will store: quantity 3 is three entries.
  const roomRates = lines.flatMap((line) => Array<number>(line.quantity).fill(line.nightlyRate))
  const subtotal = round(roomRates.reduce((sum, rate) => sum + rate, 0) * nights)

  const settings = await payload.findGlobal({
    slug: 'platform-settings',
    depth: 0,
    overrideAccess: true,
  })
  const loyalty = settings.loyaltyProgram

  const coupon = request.couponCode
    ? await evaluateCouponCode(payload, {
        code: request.couponCode,
        subtotal,
        propertyId,
        userId: request.guestId ?? null,
      })
    : null
  if (coupon && !coupon.valid && coupon.reason) issues.push(coupon.reason)

  const points = await resolvePoints(payload, {
    requested: Math.max(Math.floor(request.pointsRedeemed ?? 0), 0),
    guestId: request.guestId ?? null,
    remainder: subtotal - (coupon?.valid ? coupon.discountAmount : 0),
    loyalty: {
      enabled: loyalty?.enabled ?? false,
      redeemRate: loyalty?.redeemRate ?? 0,
      minRedeemPoints: loyalty?.minRedeemPoints ?? 0,
      maxRedeemPercentOfBooking: loyalty?.maxRedeemPercentOfBooking ?? 0,
    },
  })
  if (points.reason) issues.push(points.reason)

  const property = await payload.findByID({
    collection: 'properties',
    id: propertyId,
    depth: 0,
    overrideAccess: true,
    select: { commissionRateOverride: true },
  })

  const pricing = computePricing({
    roomRates,
    checkInDate: request.checkInDate,
    checkOutDate: request.checkOutDate,
    commissionRate: property.commissionRateOverride ?? settings.defaultCommissionRate,
    coupon: coupon?.valid ? coupon.coupon : null,
    pointsRedeemed: points.applied,
    redeemRate: loyalty?.redeemRate ?? 0,
    maxRedeemPercentOfBooking: loyalty?.maxRedeemPercentOfBooking ?? 0,
  })

  const guests = (request.adults ?? 0) + (request.children ?? 0)
  const maxGuests = lines.reduce((sum, line) => sum + line.maxOccupancy * line.quantity, 0)
  // A capacity of zero means no room type declared one; that is a data gap, not a full room.
  const fits = maxGuests === 0 || guests === 0 || guests <= maxGuests
  if (!fits) {
    issues.push(
      `The selected rooms sleep ${maxGuests} ${maxGuests === 1 ? 'guest' : 'guests'}; add another room for a party of ${guests}.`,
    )
  }

  return {
    propertyId,
    currency: settings.currency ?? 'BDT',
    nights,
    rooms,
    lines,
    pricing,
    coupon,
    points: {
      requested: Math.max(Math.floor(request.pointsRedeemed ?? 0), 0),
      applied: points.applied,
      discountAmount: pricing.pointsDiscountAmount,
      ...(points.reason ? { reason: points.reason } : {}),
    },
    capacity: { guests, maxGuests, fits },
    issues,
  }
}

/**
 * Points are quoted, not spent, so an ineligible request degrades to zero with a reason rather than
 * failing the whole quote — the guest still needs to see what the stay costs.
 */
async function resolvePoints(
  payload: Payload,
  args: {
    requested: number
    guestId: number | string | null
    remainder: number
    loyalty: {
      enabled: boolean
      redeemRate: number
      minRedeemPoints: number
      maxRedeemPercentOfBooking: number
    }
  },
): Promise<{ applied: number; reason?: string }> {
  if (args.requested <= 0) return { applied: 0 }
  if (!args.loyalty.enabled) return { applied: 0, reason: 'Points redemption is disabled.' }
  if (args.guestId == null) {
    return { applied: 0, reason: 'Sign in to redeem points.' }
  }

  const guest = await payload.findByID({
    collection: 'users',
    id: args.guestId,
    depth: 0,
    overrideAccess: true,
    select: { pointsBalance: true },
  })

  const result = validateRedemption(
    args.requested,
    guest.pointsBalance ?? 0,
    {
      redeemRate: args.loyalty.redeemRate,
      minRedeemPoints: args.loyalty.minRedeemPoints,
      maxRedeemPercentOfBooking: args.loyalty.maxRedeemPercentOfBooking,
    },
    args.remainder,
  )

  return result.ok
    ? { applied: args.requested }
    : { applied: 0, reason: result.reason ?? 'These points cannot be redeemed.' }
}

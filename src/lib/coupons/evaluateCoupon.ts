import type { Payload } from 'payload'

import { computeCouponDiscount } from '../pricing/computePricing'
import { validateCoupon, type CouponForValidation } from './validateCoupon'

/**
 * Look a coupon up by code and decide whether it applies to a given subtotal.
 *
 * The eligibility rules themselves live in `validateCoupon`, which is pure. This wrapper is the
 * database half: it resolves the code, counts the user's prior uses, and works out whether this would
 * be their first booking. Both `/api/coupons/apply` and the pricing quote go through here so a coupon
 * cannot be accepted by one and rejected by the other.
 */

export interface CouponEvaluationContext {
  code: string
  subtotal: number
  propertyId: number | string
  userId?: number | string | null
}

export interface CouponEvaluation {
  code: string
  valid: boolean
  reason?: string
  discountAmount: number
  /** Present only when the code resolved to a real coupon, valid or not. */
  couponId?: number
  coupon?: CouponForValidation | null
}

/** Statuses that count as "this guest has booked before" for first-booking-only coupons. */
const BOOKED_BEFORE_STATUSES = ['pending_payment', 'confirmed', 'checked_in', 'checked_out']

export function toCouponForValidation(doc: Record<string, unknown>): CouponForValidation {
  const coupon = doc as unknown as CouponForValidation
  return { ...coupon, scopeProperties: coupon.scopeProperties ?? null }
}

export async function evaluateCouponCode(
  payload: Payload,
  ctx: CouponEvaluationContext,
): Promise<CouponEvaluation> {
  const code = ctx.code.trim().toUpperCase()
  if (!code) return { code, valid: false, reason: 'Enter a coupon code.', discountAmount: 0 }

  const { docs } = await payload.find({
    collection: 'coupons',
    where: { code: { equals: code } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const doc = docs[0]
  if (!doc) {
    return { code, valid: false, reason: `Coupon "${code}" does not exist.`, discountAmount: 0 }
  }

  const property = await payload.findByID({
    collection: 'properties',
    id: ctx.propertyId,
    depth: 0,
    overrideAccess: true,
    select: { tier: true, address: true },
  })

  let userUsageCount = 0
  let isFirstBooking = true
  if (ctx.userId != null) {
    const [{ totalDocs: usage }, { totalDocs: priorBookings }] = await Promise.all([
      payload.count({
        collection: 'bookings',
        where: { and: [{ guest: { equals: ctx.userId } }, { couponApplied: { equals: doc.id } }] },
        overrideAccess: true,
      }),
      payload.count({
        collection: 'bookings',
        where: {
          and: [{ guest: { equals: ctx.userId } }, { status: { in: BOOKED_BEFORE_STATUSES } }],
        },
        overrideAccess: true,
      }),
    ])
    userUsageCount = usage
    isFirstBooking = priorBookings === 0
  }

  const coupon = toCouponForValidation(doc as unknown as Record<string, unknown>)
  const result = validateCoupon(coupon, {
    subtotal: ctx.subtotal,
    propertyId: property.id,
    propertyTier: property.tier,
    propertyCity: property.address?.city,
    userUsageCount,
    isFirstBooking,
  })

  if (!result.ok) {
    return {
      code,
      valid: false,
      reason: result.reason,
      discountAmount: 0,
      couponId: doc.id as number,
      coupon,
    }
  }

  return {
    code,
    valid: true,
    discountAmount: computeCouponDiscount(coupon, ctx.subtotal),
    couponId: doc.id as number,
    coupon,
  }
}

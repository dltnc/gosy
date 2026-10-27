export type CouponScope = 'all_properties' | 'specific_properties' | 'tier' | 'city'

export interface CouponForValidation {
  code: string
  active: boolean
  validFrom?: string | Date | null
  validUntil?: string | Date | null
  discountType: 'percent' | 'fixed'
  discountValue: number
  maxDiscountAmount?: number | null
  minBookingAmount?: number | null
  usageLimitTotal?: number | null
  usesPerUser?: number | null
  firstBookingOnly: boolean
  scope: CouponScope
  scopeProperties?: (string | { id: string })[] | null
  scopeTier?: string | null
  scopeCity?: string | null
  currentUsageCount?: number | null
}

export interface CouponValidationContext {
  subtotal: number
  propertyId: string | number
  propertyTier?: string | null
  propertyCity?: string | null
  now?: Date
  userUsageCount: number
  isFirstBooking: boolean
}

export interface CouponValidationResult {
  ok: boolean
  reason?: string
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function validateCoupon(
  coupon: CouponForValidation,
  ctx: CouponValidationContext,
): CouponValidationResult {
  if (!coupon.active) return { ok: false, reason: 'This coupon is no longer active.' }

  const now = ctx.now ?? new Date()
  const from = toDate(coupon.validFrom)
  const until = toDate(coupon.validUntil)

  if (from && now < from) return { ok: false, reason: 'This coupon is not active yet.' }
  if (until && now > until) return { ok: false, reason: 'This coupon has expired.' }

  if (coupon.minBookingAmount != null && coupon.minBookingAmount > 0) {
    if (ctx.subtotal < coupon.minBookingAmount) {
      return {
        ok: false,
        reason: `This coupon requires a minimum booking amount of ${coupon.minBookingAmount}.`,
      }
    }
  }

  if (
    coupon.usageLimitTotal != null &&
    coupon.usageLimitTotal > 0 &&
    (coupon.currentUsageCount ?? 0) >= coupon.usageLimitTotal
  ) {
    return { ok: false, reason: 'This coupon has reached its usage limit.' }
  }

  if (
    coupon.usesPerUser != null &&
    coupon.usesPerUser > 0 &&
    ctx.userUsageCount >= coupon.usesPerUser
  ) {
    return { ok: false, reason: 'You have already used this coupon the maximum number of times.' }
  }

  if (coupon.firstBookingOnly && !ctx.isFirstBooking) {
    return { ok: false, reason: 'This coupon is only valid for your first booking.' }
  }

  switch (coupon.scope) {
    case 'all_properties':
      break
    case 'specific_properties': {
      const ids = (coupon.scopeProperties ?? []).map((p) =>
        typeof p === 'string' ? p : p.id,
      )
      if (!ids.map(String).includes(String(ctx.propertyId))) {
        return { ok: false, reason: 'This coupon does not apply to this property.' }
      }
      break
    }
    case 'tier':
      if (!ctx.propertyTier || ctx.propertyTier !== coupon.scopeTier) {
        return { ok: false, reason: 'This coupon does not apply to this property tier.' }
      }
      break
    case 'city':
      if (!ctx.propertyCity || ctx.propertyCity.toLowerCase() !== (coupon.scopeCity ?? '').toLowerCase()) {
        return { ok: false, reason: 'This coupon does not apply to this city.' }
      }
      break
    default:
      return { ok: false, reason: 'Invalid coupon scope.' }
  }

  return { ok: true }
}

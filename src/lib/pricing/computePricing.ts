export interface CouponLike {
  discountType: 'percent' | 'fixed'
  discountValue: number
  maxDiscountAmount?: number | null
}

export interface PricingInput {
  /**
   * Nightly rate of every room on the booking, one entry per physical room. A three-room booking
   * passes three rates; mixed room types pass their differing rates. The subtotal is the sum times
   * the night count, so a single-room stay is just a one-element array.
   */
  roomRates: number[]
  checkInDate: string | Date
  checkOutDate: string | Date
  commissionRate: number
  coupon?: CouponLike | null
  pointsRedeemed?: number
  redeemRate?: number
  maxRedeemPercentOfBooking?: number
}

export interface PricingResult {
  nights: number
  subtotal: number
  couponDiscountAmount: number
  pointsDiscountAmount: number
  totalAmount: number
  commissionRate: number
  commissionAmount: number
  partnerPayoutAmount: number
}

const MS_PER_DAY = 86_400_000

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export function computeNights(checkIn: string | Date, checkOut: string | Date): number {
  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / MS_PER_DAY,
  )
  return Math.max(nights, 0)
}

export function computeCouponDiscount(coupon: CouponLike | null | undefined, subtotal: number): number {
  if (!coupon || subtotal <= 0) return 0
  let discount =
    coupon.discountType === 'percent' ? (subtotal * coupon.discountValue) / 100 : coupon.discountValue
  if (coupon.maxDiscountAmount != null && coupon.maxDiscountAmount > 0) {
    discount = Math.min(discount, coupon.maxDiscountAmount)
  }
  return round(Math.min(Math.max(discount, 0), subtotal))
}

export function computePointsDiscount(
  pointsRedeemed: number,
  redeemRate: number,
  maxRedeemPercentOfBooking: number,
  remainderAfterCoupon: number,
): number {
  if (!pointsRedeemed || pointsRedeemed <= 0 || redeemRate <= 0) return 0
  const raw = pointsRedeemed * redeemRate
  const cappedByPolicy = (remainderAfterCoupon * maxRedeemPercentOfBooking) / 100
  return round(Math.min(Math.max(raw, 0), cappedByPolicy, remainderAfterCoupon))
}

export function computePricing(input: PricingInput): PricingResult {
  const {
    roomRates,
    checkInDate,
    checkOutDate,
    commissionRate,
    coupon,
    pointsRedeemed = 0,
    redeemRate = 0,
    maxRedeemPercentOfBooking = 0,
  } = input

  const nights = computeNights(checkInDate, checkOutDate)
  const ratePerNight = roomRates.reduce((sum, rate) => sum + (Number(rate) || 0), 0)
  const subtotal = round(ratePerNight * nights)

  const couponDiscountAmount = computeCouponDiscount(coupon, subtotal)
  const remainderAfterCoupon = subtotal - couponDiscountAmount
  const pointsDiscountAmount =
    couponDiscountAmount >= subtotal
      ? 0
      : computePointsDiscount(pointsRedeemed, redeemRate, maxRedeemPercentOfBooking, remainderAfterCoupon)

  const totalAmount = round(subtotal - couponDiscountAmount - pointsDiscountAmount)

  const effectiveRate = Math.min(Math.max(commissionRate, 0), 100)
  const commissionAmount = round((subtotal * effectiveRate) / 100)
  const partnerPayoutAmount = round(subtotal - commissionAmount)

  return {
    nights,
    subtotal,
    couponDiscountAmount,
    pointsDiscountAmount,
    totalAmount,
    commissionRate: effectiveRate,
    commissionAmount,
    partnerPayoutAmount,
  }
}

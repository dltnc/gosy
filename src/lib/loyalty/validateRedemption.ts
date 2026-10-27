export interface LoyaltyProgramSettings {
  redeemRate: number
  minRedeemPoints: number
  maxRedeemPercentOfBooking: number
}

export interface RedemptionResult {
  ok: boolean
  reason?: string
  discountAmount?: number
}

export function validateRedemption(
  pointsRequested: number,
  pointsBalance: number,
  settings: LoyaltyProgramSettings,
  subtotalAfterCoupon: number,
): RedemptionResult {
  if (!Number.isInteger(pointsRequested) || pointsRequested <= 0) {
    return { ok: false, reason: 'Points to redeem must be a positive whole number.' }
  }

  if (pointsBalance < pointsRequested) {
    return { ok: false, reason: 'You do not have enough loyalty points.' }
  }

  if (pointsRequested < settings.minRedeemPoints) {
    return {
      ok: false,
      reason: `Minimum redemption is ${settings.minRedeemPoints} points.`,
    }
  }

  if (settings.redeemRate <= 0) {
    return { ok: false, reason: 'Points redemption is not available right now.' }
  }

  const discountAmount = Math.round(pointsRequested * settings.redeemRate)
  const maxAllowed = Math.round((subtotalAfterCoupon * settings.maxRedeemPercentOfBooking) / 100)

  if (discountAmount > maxAllowed) {
    const maxPoints = Math.floor(maxAllowed / settings.redeemRate)
    return {
      ok: false,
      reason: `You can redeem at most ${maxPoints} points on this booking (up to ${settings.maxRedeemPercentOfBooking}% of the subtotal).`,
    }
  }

  return { ok: true, discountAmount }
}

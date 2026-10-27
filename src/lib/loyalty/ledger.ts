import type { Payload, PayloadRequest } from 'payload'
import { APIError } from 'payload'

export type LedgerEntryType = 'earn' | 'redeem' | 'expire' | 'reverse' | 'adjust'

const TYPE_SIGNS: Record<LedgerEntryType, number> = {
  earn: 1,
  redeem: -1,
  expire: -1,
  reverse: -1,
  adjust: 1,
}

export function ledgerSignedAmount(type: LedgerEntryType, amount: number): number {
  const sign = TYPE_SIGNS[type]
  return sign >= 0 ? Math.abs(amount) : -Math.abs(amount)
}

export async function postLedgerEntry(
  payload: Payload,
  entry: {
    user: string | number
    type: LedgerEntryType
    amount: number
    sourceBooking?: string | number | null
    expiresAt?: string | Date | null
    notes?: string | null
  },
  req?: PayloadRequest,
): Promise<void> {
  await payload.create({
    collection: 'loyalty-points',
    data: {
      user: entry.user as unknown as number,
      type: entry.type,
      amount: ledgerSignedAmount(entry.type, entry.amount),
      sourceBooking: (entry.sourceBooking ?? undefined) as unknown as number | undefined,
      expiresAt:
        entry.expiresAt instanceof Date ? entry.expiresAt.toISOString() : entry.expiresAt ?? undefined,
      notes: entry.notes ?? undefined,
    },
    req,
  })
}

export async function recomputeUserPointsBalance(
  payload: Payload,
  userId: string | number,
  req?: PayloadRequest,
): Promise<number> {
  const { docs } = await payload.find({
    collection: 'loyalty-points',
    where: { user: { equals: userId } },
    limit: 0,
    depth: 0,
    select: { amount: true },
    req,
  })

  const balance = docs.reduce((sum, doc) => sum + (doc.amount ?? 0), 0)

  await payload.update({
    collection: 'users',
    id: userId,
    data: { pointsBalance: balance },
    req,
    context: { skipLoyaltyHooks: true },
  })

  return balance
}

function resolveUserId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    if (id != null) return id
  }
  return undefined
}

export interface RedeemableBooking {
  id: string | number
  guest: unknown
  pointsRedeemed?: number | null
  bookingRef?: string | null
}

async function countBookingLedgerRows(
  payload: Payload,
  bookingId: string | number,
  type: LedgerEntryType,
  req?: PayloadRequest,
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'loyalty-points',
    where: {
      and: [{ sourceBooking: { equals: bookingId } }, { type: { equals: type } }],
    },
    req,
  })
  return totalDocs
}

/**
 * Debits the points a guest chose to redeem at checkout.
 *
 * Called from the bookings afterChange hook on create. Idempotent: a booking
 * never gets debited twice, so replaying the hook is safe. Re-checks the
 * balance before writing — `beforeValidate` already validated it, but two
 * concurrent checkouts can both pass that check against the same balance, and
 * throwing here rolls back the surrounding transaction rather than letting the
 * ledger go negative.
 */
export async function postBookingRedemption(
  payload: Payload,
  booking: RedeemableBooking,
  req?: PayloadRequest,
): Promise<boolean> {
  const points = booking.pointsRedeemed ?? 0
  if (points <= 0) return false

  const userId = resolveUserId(booking.guest)
  if (userId == null) return false

  if ((await countBookingLedgerRows(payload, booking.id, 'redeem', req)) > 0) return false

  const guest = await payload.findByID({
    collection: 'users',
    id: userId,
    depth: 0,
    select: { pointsBalance: true },
    req,
  })

  if ((guest.pointsBalance ?? 0) < points) {
    throw new APIError('You no longer have enough loyalty points to cover this redemption.', 400)
  }

  await postLedgerEntry(
    payload,
    {
      user: userId,
      type: 'redeem',
      amount: points,
      sourceBooking: booking.id,
      notes: `Redeemed against booking ${booking.bookingRef ?? booking.id}`,
    },
    req,
  )

  return true
}

/**
 * Credits redeemed points back when a booking is cancelled or expires unpaid.
 *
 * Uses `adjust` rather than `reverse` because the balance has to go *up* —
 * `reverse` is negative-signed and is what undoes an `earn`. Idempotent on
 * (sourceBooking, adjust) so the cancel hook and the abandoned-booking job can
 * both call it for the same booking without double-crediting.
 */
export async function refundBookingRedemption(
  payload: Payload,
  booking: RedeemableBooking,
  req?: PayloadRequest,
): Promise<boolean> {
  const points = booking.pointsRedeemed ?? 0
  if (points <= 0) return false

  const userId = resolveUserId(booking.guest)
  if (userId == null) return false

  // Nothing to give back if the debit never landed.
  if ((await countBookingLedgerRows(payload, booking.id, 'redeem', req)) === 0) return false
  if ((await countBookingLedgerRows(payload, booking.id, 'adjust', req)) > 0) return false

  await postLedgerEntry(
    payload,
    {
      user: userId,
      type: 'adjust',
      amount: points,
      sourceBooking: booking.id,
      notes: `Returned points redeemed on cancelled booking ${booking.bookingRef ?? booking.id}`,
    },
    req,
  )

  return true
}

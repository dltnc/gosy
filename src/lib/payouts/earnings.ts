import type { Payload, PayloadRequest } from 'payload'

/**
 * What a partner is owed, and what has already been claimed against it.
 *
 * Only a completed stay is payable: the guest has come and gone, the cancellation window is behind
 * us, and `pricing.partnerPayoutAmount` was frozen on the booking at create time (gross minus the
 * commission that applied then). Recomputing the commission here would silently repay old bookings
 * at today's rate, so this module never does arithmetic on rates — it only adds up frozen amounts.
 */

export const PAYOUT_STATUSES = ['requested', 'approved', 'processing', 'paid', 'rejected'] as const

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

/** A request that is still in flight: not money in hand, but already claimed against the balance. */
export const PAYOUT_OPEN_STATUSES: PayoutStatus[] = ['requested', 'approved', 'processing']

/** The one booking status that releases money to the partner. */
export const PAYABLE_BOOKING_STATUS = 'checked_out'

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export interface PayoutRow {
  amount: number
  status: PayoutStatus
}

export interface PayoutSummary {
  /** Σ frozen `partnerPayoutAmount` over completed stays. */
  lifetimeEarned: number
  /** Σ payouts marked paid. */
  paidOut: number
  /** Σ payouts requested, approved or processing — claimed but not yet disbursed. */
  pending: number
  /** What a new request may ask for at most. Never negative. */
  available: number
}

/**
 * Pure balance rule, kept apart from the queries so it can be unit-tested without a database.
 *
 * Rejected rows are ignored: a rejection releases the amount back to the partner. Pending rows are
 * subtracted even though no money has moved, otherwise a partner could request the same balance
 * twice while the first request sat in the admin's queue.
 */
export function summarizePayouts(lifetimeEarned: number, payouts: PayoutRow[]): PayoutSummary {
  let paidOut = 0
  let pending = 0
  for (const row of payouts) {
    const amount = Number(row.amount) || 0
    if (row.status === 'paid') paidOut += amount
    else if (PAYOUT_OPEN_STATUSES.includes(row.status)) pending += amount
  }
  const earned = round(Number(lifetimeEarned) || 0)
  paidOut = round(paidOut)
  pending = round(pending)
  return {
    lifetimeEarned: earned,
    paidOut,
    pending,
    // Clamped at zero: an admin can pay more than the ledger says (a goodwill top-up, a correction),
    // and that must not read as a negative amount the partner could somehow request.
    available: Math.max(round(earned - paidOut - pending), 0),
  }
}

interface LoadOptions {
  req?: PayloadRequest
}

/** Σ frozen payout amounts over this partner's completed stays. */
export async function sumPayableBookings(
  payload: Payload,
  partnerId: string | number,
  options: LoadOptions = {},
): Promise<number> {
  let total = 0
  let page = 1
  // Paged rather than one huge `limit`: a busy hotel outgrows any single page eventually, and this
  // total is the ceiling on real money leaving the platform.
  for (;;) {
    const { docs, hasNextPage } = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { 'property.partner': { equals: partnerId } },
          { status: { equals: PAYABLE_BOOKING_STATUS } },
        ],
      },
      select: { pricing: true },
      depth: 0,
      limit: 500,
      page,
      pagination: true,
      overrideAccess: true,
      ...(options.req ? { req: options.req } : {}),
    })
    for (const booking of docs) total += Number(booking.pricing?.partnerPayoutAmount ?? 0) || 0
    if (!hasNextPage) break
    page += 1
  }
  return round(total)
}

/** Every payout row for this partner, as the balance rule wants them. */
export async function loadPayoutRows(
  payload: Payload,
  partnerId: string | number,
  options: LoadOptions = {},
): Promise<PayoutRow[]> {
  const rows: PayoutRow[] = []
  let page = 1
  for (;;) {
    const { docs, hasNextPage } = await payload.find({
      collection: 'payouts',
      where: { partner: { equals: partnerId } },
      select: { amount: true, status: true },
      depth: 0,
      limit: 500,
      page,
      pagination: true,
      overrideAccess: true,
      ...(options.req ? { req: options.req } : {}),
    })
    for (const doc of docs) {
      rows.push({ amount: Number(doc.amount) || 0, status: doc.status as PayoutStatus })
    }
    if (!hasNextPage) break
    page += 1
  }
  return rows
}

/**
 * The balance the partner dashboard shows and the request endpoint validates against.
 *
 * Both callers go through this one function so the number on screen is the number the server will
 * accept — a partner should never be shown ৳20,000 available and then told ৳20,000 is too much.
 */
export async function getPartnerPayoutSummary(
  payload: Payload,
  partnerId: string | number,
  options: LoadOptions = {},
): Promise<PayoutSummary> {
  const [lifetimeEarned, rows] = await Promise.all([
    sumPayableBookings(payload, partnerId, options),
    loadPayoutRows(payload, partnerId, options),
  ])
  return summarizePayouts(lifetimeEarned, rows)
}

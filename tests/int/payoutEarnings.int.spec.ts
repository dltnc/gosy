import { describe, expect, it } from 'vitest'

import {
  PAYOUT_OPEN_STATUSES,
  PAYOUT_STATUSES,
  summarizePayouts,
  type PayoutRow,
} from '@/lib/payouts/earnings'

/**
 * The payout balance rule, without a database.
 *
 * This is the arithmetic that decides how much real money a partner may ask for, so it is pinned
 * here rather than only exercised through the collection hook: the hook needs Postgres, this does
 * not, and a wrong sign here is a wrong bank transfer.
 */

function row(amount: number, status: PayoutRow['status']): PayoutRow {
  return { amount, status }
}

describe('summarizePayouts', () => {
  it('reports the full balance as available when nothing has been claimed', () => {
    const summary = summarizePayouts(12_500, [])
    expect(summary).toEqual({
      lifetimeEarned: 12_500,
      paidOut: 0,
      pending: 0,
      available: 12_500,
    })
  })

  it('subtracts paid and in-flight requests, and ignores rejected ones', () => {
    const summary = summarizePayouts(20_000, [
      row(5_000, 'paid'),
      row(2_000, 'requested'),
      row(1_000, 'approved'),
      row(500, 'processing'),
      // A rejection releases the amount: the partner never received it.
      row(9_000, 'rejected'),
    ])
    expect(summary.paidOut).toBe(5_000)
    expect(summary.pending).toBe(3_500)
    expect(summary.available).toBe(11_500)
  })

  it('treats every open status as claimed, so the same balance cannot be requested twice', () => {
    for (const status of PAYOUT_OPEN_STATUSES) {
      const summary = summarizePayouts(1_000, [row(1_000, status)])
      expect(summary.available, status).toBe(0)
      expect(summary.pending, status).toBe(1_000)
    }
  })

  it('never reports a negative balance when an admin has overpaid', () => {
    // Admins may pay more than the ledger owes (a goodwill top-up or a correction). That must read
    // as nothing left to request, not as a negative number a form could send back.
    const summary = summarizePayouts(1_000, [row(2_500, 'paid')])
    expect(summary.paidOut).toBe(2_500)
    expect(summary.available).toBe(0)
  })

  it('keeps money to two decimals instead of accumulating float noise', () => {
    const summary = summarizePayouts(0.1 + 0.2, [row(0.15, 'paid'), row(0.05, 'requested')])
    expect(summary.lifetimeEarned).toBe(0.3)
    expect(summary.available).toBe(0.1)
  })

  it('ignores unusable amounts rather than poisoning the total with NaN', () => {
    const summary = summarizePayouts(5_000, [
      { amount: Number.NaN, status: 'paid' },
      { amount: null as unknown as number, status: 'requested' },
      row(1_000, 'paid'),
    ])
    expect(summary.paidOut).toBe(1_000)
    expect(summary.pending).toBe(0)
    expect(summary.available).toBe(4_000)
  })

  it('accounts for every declared status, so a new one cannot be silently dropped', () => {
    const unaccounted = PAYOUT_STATUSES.filter(
      (status) =>
        status !== 'paid' && status !== 'rejected' && !PAYOUT_OPEN_STATUSES.includes(status),
    )
    expect(unaccounted).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import { PAYOUT_OPEN_STATUSES } from '@/lib/payouts/earnings'
import { PAYOUT_STALE_DAYS, summarizeQueue } from '@/lib/payouts/queue'
import type { RawQueuePayout } from '@/lib/payouts/queue'

const NOW = new Date('2026-08-30T12:00:00.000Z')

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

function row(overrides: Partial<RawQueuePayout> = {}): RawQueuePayout {
  return {
    id: 1,
    amount: 1_000,
    status: 'requested',
    method: 'bkash',
    requestedAt: daysAgo(1),
    destination: { accountNumber: '01711000000', accountName: 'Sea Pearl' },
    partner: { id: 7, name: 'Rafi', partnerProfile: { businessName: 'Sea Pearl Resort' } },
    ...overrides,
  }
}

describe('summarizeQueue', () => {
  it('keeps only outstanding requests, so finished work cannot clog the queue', () => {
    const summary = summarizeQueue(
      [
        row({ id: 1, status: 'requested', amount: 1_000 }),
        row({ id: 2, status: 'approved', amount: 2_000 }),
        row({ id: 3, status: 'processing', amount: 3_000 }),
        row({ id: 4, status: 'paid', amount: 9_000 }),
        row({ id: 5, status: 'rejected', amount: 8_000 }),
      ],
      NOW,
    )

    // Same age, so the amount tie-break decides the order.
    expect(summary.rows.map((r) => r.id)).toEqual([3, 2, 1])
    expect(summary.outstandingCount).toBe(3)
    expect(summary.outstandingTotal).toBe(6_000)
  })

  it('sorts by longest wait, breaking ties on the larger amount', () => {
    const summary = summarizeQueue(
      [
        row({ id: 'a', requestedAt: daysAgo(1), amount: 500 }),
        row({ id: 'b', requestedAt: daysAgo(9), amount: 500 }),
        row({ id: 'c', requestedAt: daysAgo(1), amount: 7_500 }),
      ],
      NOW,
    )

    expect(summary.rows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
    expect(summary.oldestAgeDays).toBe(9)
  })

  it('flags requests past the stale threshold and counts them', () => {
    const summary = summarizeQueue(
      [
        row({ id: 'fresh', requestedAt: daysAgo(PAYOUT_STALE_DAYS - 1) }),
        row({ id: 'stale', requestedAt: daysAgo(PAYOUT_STALE_DAYS) }),
        row({ id: 'staler', requestedAt: daysAgo(PAYOUT_STALE_DAYS + 5) }),
      ],
      NOW,
    )

    expect(summary.staleCount).toBe(2)
    expect(summary.rows.find((r) => r.id === 'fresh')?.stale).toBe(false)
    expect(summary.rows.find((r) => r.id === 'stale')?.stale).toBe(true)
  })

  it('never reports a negative age when a clock puts a request in the future', () => {
    const summary = summarizeQueue([row({ requestedAt: daysAgo(-2) })], NOW)

    expect(summary.rows[0].ageDays).toBe(0)
    expect(summary.rows[0].stale).toBe(false)
  })

  it('sorts undated rows last rather than treating a missing date as urgent', () => {
    const summary = summarizeQueue(
      [row({ id: 'undated', requestedAt: null }), row({ id: 'dated', requestedAt: daysAgo(1) })],
      NOW,
    )

    expect(summary.rows.map((r) => r.id)).toEqual(['dated', 'undated'])
    expect(summary.rows[1].ageDays).toBeNull()
  })

  it('prefers the business name, then the account name, then the id for a partner label', () => {
    const summary = summarizeQueue(
      [
        row({
          id: 1,
          partner: { id: 7, name: 'Rafi', partnerProfile: { businessName: 'Sea Pearl' } },
        }),
        row({ id: 2, partner: { id: 8, name: 'Nadia', partnerProfile: { businessName: '  ' } } }),
        row({ id: 3, partner: { id: 9, email: 'host@example.com' } }),
        row({ id: 4, partner: 10 }),
        row({ id: 5, partner: null }),
      ],
      NOW,
    )

    const labels = new Map(summary.rows.map((r) => [r.id, r.partnerLabel]))
    expect(labels.get(1)).toBe('Sea Pearl')
    expect(labels.get(2)).toBe('Nadia')
    expect(labels.get(3)).toBe('host@example.com')
    // A depth-0 read leaves the raw id, which is still enough to find the row.
    expect(labels.get(4)).toBe('Partner #10')
    expect(labels.get(5)).toBe('Unknown partner')
  })

  it('builds a readable destination and tolerates a missing one', () => {
    const summary = summarizeQueue(
      [
        row({ id: 1, destination: { accountNumber: '017', accountName: 'Rafi' } }),
        row({ id: 2, destination: { accountNumber: '018', accountName: null } }),
        row({ id: 3, destination: null }),
      ],
      NOW,
    )

    const dests = new Map(summary.rows.map((r) => [r.id, r.destination]))
    expect(dests.get(1)).toBe('017 · Rafi')
    expect(dests.get(2)).toBe('018')
    expect(dests.get(3)).toBeNull()
  })

  it('groups outstanding totals by status and drops empty buckets', () => {
    const summary = summarizeQueue(
      [
        row({ id: 1, status: 'requested', amount: 1_000 }),
        row({ id: 2, status: 'requested', amount: 250.555 }),
        row({ id: 3, status: 'processing', amount: 400 }),
      ],
      NOW,
    )

    expect(summary.byStatus).toEqual([
      { status: 'requested', count: 2, total: 1_250.56 },
      { status: 'processing', count: 1, total: 400 },
    ])
  })

  it('ignores unusable amounts instead of poisoning the total', () => {
    const summary = summarizeQueue(
      [
        row({ id: 1, amount: 1_000 }),
        row({ id: 2, amount: null }),
        row({ id: 3, amount: Number.NaN }),
      ],
      NOW,
    )

    expect(summary.outstandingTotal).toBe(1_000)
  })

  it('accounts for every open status, so a new one cannot go unlisted', () => {
    const summary = summarizeQueue(
      PAYOUT_OPEN_STATUSES.map((status, index) => row({ id: index, status, amount: 100 })),
      NOW,
    )

    expect(summary.outstandingCount).toBe(PAYOUT_OPEN_STATUSES.length)
    expect(summary.byStatus.map((b) => b.status)).toEqual(PAYOUT_OPEN_STATUSES)
  })

  it('passes the truncation flag through so a capped read is not read as the whole backlog', () => {
    expect(summarizeQueue([row()], NOW, true).truncated).toBe(true)
    expect(summarizeQueue([row()], NOW).truncated).toBe(false)
  })
})

import type { Payload, PayloadRequest } from 'payload'

import { PAYOUT_OPEN_STATUSES, type PayoutStatus } from './earnings'

/**
 * The admin side of payouts: what is waiting to be sent.
 *
 * This is a work queue, not a report. It answers one question — whose money have we not sent yet,
 * and how long have they been waiting — so it sorts oldest-first and leads with age rather than
 * amount. A partner chasing an unpaid balance is the most expensive support conversation on this
 * platform, and the only defence is seeing the request before they do.
 *
 * Kept apart from `earnings.ts` on purpose: that module is per-partner balance arithmetic that gates
 * writes, this one is a platform-wide read that gates nothing.
 */

/** How long a request may sit before the queue calls it out. */
export const PAYOUT_STALE_DAYS = 3

const MS_PER_DAY = 86_400_000

/** Raw shape this module needs from a payout row, however it was loaded. */
export interface RawQueuePayout {
  id: number | string
  amount?: number | null
  status?: string | null
  method?: string | null
  requestedAt?: string | null
  destination?: { accountName?: string | null; accountNumber?: string | null } | null
  partner?:
    | number
    | string
    | {
        id: number | string
        name?: string | null
        email?: string | null
        partnerProfile?: { businessName?: string | null } | null
      }
    | null
}

export interface PayoutQueueRow {
  id: number | string
  partnerLabel: string
  amount: number
  method: string
  status: PayoutStatus
  requestedAt: string | null
  /** Whole days since the request was filed. `null` when the row has no date to measure from. */
  ageDays: number | null
  destination: string | null
  stale: boolean
}

export interface PayoutQueueSummary {
  /** Outstanding requests, oldest first. */
  rows: PayoutQueueRow[]
  outstandingCount: number
  outstandingTotal: number
  /** Requests older than {@link PAYOUT_STALE_DAYS}. */
  staleCount: number
  oldestAgeDays: number | null
  /** Outstanding totals split by where each request sits in the workflow. */
  byStatus: { status: PayoutStatus; count: number; total: number }[]
  /** True when the row cap was hit, so the totals are a floor rather than the whole picture. */
  truncated: boolean
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function partnerLabel(partner: RawQueuePayout['partner']): string {
  if (partner == null) return 'Unknown partner'
  // A depth-0 read leaves an id behind. Showing it is better than showing nothing: the admin can
  // still open the row, and the alternative is a widget that hides work because a join was skipped.
  if (typeof partner === 'number' || typeof partner === 'string') return `Partner #${partner}`
  return (
    partner.partnerProfile?.businessName?.trim() ||
    partner.name?.trim() ||
    partner.email?.trim() ||
    `Partner #${partner.id}`
  )
}

function destinationLabel(destination: RawQueuePayout['destination']): string | null {
  if (!destination) return null
  const account = destination.accountNumber?.trim()
  const name = destination.accountName?.trim()
  if (account && name) return `${account} · ${name}`
  return account || name || null
}

function ageInDays(requestedAt: string | null, now: number): number | null {
  if (!requestedAt) return null
  const filed = new Date(requestedAt).getTime()
  if (!Number.isFinite(filed)) return null
  // Floored, and never negative: a clock skew that puts a request slightly in the future should read
  // as "today", not as a negative age that sorts to the top of the queue.
  return Math.max(Math.floor((now - filed) / MS_PER_DAY), 0)
}

/**
 * Pure queue rule, so the sorting and the aging can be tested without a database.
 *
 * Rows that are not outstanding are dropped rather than shown greyed out: `paid` and `rejected` are
 * finished work, and a queue that keeps finished work stops being read.
 */
export function summarizeQueue(
  payouts: RawQueuePayout[],
  now: Date = new Date(),
  truncated = false,
): PayoutQueueSummary {
  const nowMs = now.getTime()
  const rows: PayoutQueueRow[] = []

  for (const payout of payouts) {
    const status = payout.status as PayoutStatus
    if (!PAYOUT_OPEN_STATUSES.includes(status)) continue
    const requestedAt = payout.requestedAt ?? null
    const ageDays = ageInDays(requestedAt, nowMs)
    rows.push({
      id: payout.id,
      partnerLabel: partnerLabel(payout.partner),
      amount: Number(payout.amount) || 0,
      method: payout.method ?? 'unknown',
      status,
      requestedAt,
      ageDays,
      destination: destinationLabel(payout.destination),
      stale: (ageDays ?? 0) >= PAYOUT_STALE_DAYS,
    })
  }

  // Oldest first, undated rows last: an undated row is a data problem, not the most urgent payment.
  rows.sort((a, b) => {
    if (a.ageDays === b.ageDays) return Number(b.amount) - Number(a.amount)
    if (a.ageDays == null) return 1
    if (b.ageDays == null) return -1
    return b.ageDays - a.ageDays
  })

  const byStatus = PAYOUT_OPEN_STATUSES.map((status) => {
    const matching = rows.filter((row) => row.status === status)
    return {
      status,
      count: matching.length,
      total: round(matching.reduce((sum, row) => sum + row.amount, 0)),
    }
  }).filter((bucket) => bucket.count > 0)

  return {
    rows,
    outstandingCount: rows.length,
    outstandingTotal: round(rows.reduce((sum, row) => sum + row.amount, 0)),
    staleCount: rows.filter((row) => row.stale).length,
    oldestAgeDays: rows.find((row) => row.ageDays != null)?.ageDays ?? null,
    byStatus,
    truncated,
  }
}

/** Cap on rows read for the queue. Well past any realistic backlog, but not unbounded. */
const QUEUE_LIMIT = 200

/**
 * Load every outstanding payout across the platform.
 *
 * Filtered in the query rather than in `summarizeQueue` so a marketplace with years of paid history
 * does not read all of it to render one widget; the pure function filters again because it also
 * serves callers that hand it a mixed list.
 */
export async function loadPayoutQueue(
  payload: Payload,
  options: { req?: PayloadRequest; now?: Date } = {},
): Promise<PayoutQueueSummary> {
  const { docs, totalDocs } = await payload.find({
    collection: 'payouts',
    where: { status: { in: PAYOUT_OPEN_STATUSES } },
    sort: 'requestedAt',
    limit: QUEUE_LIMIT,
    depth: 1,
    overrideAccess: true,
    ...(options.req ? { req: options.req } : {}),
  })

  return summarizeQueue(
    docs as RawQueuePayout[],
    options.now ?? new Date(),
    totalDocs > QUEUE_LIMIT,
  )
}

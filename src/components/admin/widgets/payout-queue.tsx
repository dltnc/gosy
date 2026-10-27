import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard, EmptyState, formatCount, formatTaka } from '@/components/admin/charts/chart-kit'
import { loadPayoutQueue, PAYOUT_STALE_DAYS } from '@/lib/payouts/queue'
import type { PayoutQueueRow, PayoutQueueSummary } from '@/lib/payouts/queue'

/**
 * Outstanding partner payouts, oldest first.
 *
 * The one widget on this dashboard that is a to-do list rather than a measurement: every row is
 * money a partner is waiting for. Nothing here mutates a payout — marking one paid needs a transfer
 * reference and goes through the collection's own edit view, where `guardTransitions` enforces the
 * status path and stamps who did it. This widget's job is to make sure no request is missed, so it
 * links straight into that view.
 */

const METHOD_LABELS: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  bank: 'Bank transfer',
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  processing: 'Processing',
}

const ROWS_SHOWN = 8

const cellStyle: React.CSSProperties = {
  padding: '7px 8px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  fontSize: 12,
  textAlign: 'left',
  verticalAlign: 'top',
}

const headStyle: React.CSSProperties = {
  ...cellStyle,
  borderBottom: '1px solid var(--theme-elevation-200)',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'var(--theme-elevation-500)',
  whiteSpace: 'nowrap',
}

function ageLabel(row: PayoutQueueRow): string {
  if (row.ageDays == null) return 'no date'
  if (row.ageDays === 0) return 'today'
  return row.ageDays === 1 ? '1 day' : `${row.ageDays} days`
}

function QueueTable({ rows, adminRoute }: { rows: PayoutQueueRow[]; adminRoute: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <caption
        style={{
          captionSide: 'top',
          textAlign: 'left',
          fontSize: 11,
          paddingBottom: 6,
          color: 'var(--theme-elevation-500)',
        }}
      >
        Payout requests awaiting action, longest wait first.
      </caption>
      <thead>
        <tr>
          <th style={headStyle} scope="col">
            Partner
          </th>
          <th style={{ ...headStyle, textAlign: 'right' }} scope="col">
            Amount
          </th>
          <th style={headStyle} scope="col">
            Send to
          </th>
          <th style={headStyle} scope="col">
            Status
          </th>
          <th style={{ ...headStyle, textAlign: 'right' }} scope="col">
            Waiting
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <th style={{ ...cellStyle, fontWeight: 600 }} scope="row">
              <a
                href={`${adminRoute}/collections/payouts/${row.id}`}
                style={{ color: 'var(--theme-text)', textDecoration: 'underline' }}
              >
                {row.partnerLabel}
              </a>
            </th>
            <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {formatTaka(row.amount)}
            </td>
            <td style={{ ...cellStyle, color: 'var(--theme-elevation-600)' }}>
              {METHOD_LABELS[row.method] ?? row.method}
              {row.destination ? (
                <span
                  style={{ display: 'block', fontSize: 11, color: 'var(--theme-elevation-450)' }}
                >
                  {row.destination}
                </span>
              ) : null}
            </td>
            <td style={{ ...cellStyle, color: 'var(--theme-elevation-600)' }}>
              {STATUS_LABELS[row.status] ?? row.status}
            </td>
            <td
              style={{
                ...cellStyle,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: row.stale ? '#e0563f' : 'var(--theme-elevation-600)',
                fontWeight: row.stale ? 600 : 400,
              }}
            >
              {ageLabel(row)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function footnote(summary: PayoutQueueSummary, hidden: number): string {
  const parts: string[] = []
  if (hidden > 0) parts.push(`${formatCount(hidden)} more not shown — open the Payouts list.`)
  if (summary.staleCount > 0) {
    parts.push(
      `${formatCount(summary.staleCount)} waiting ${PAYOUT_STALE_DAYS}+ days, marked in red.`,
    )
  }
  parts.push('Mark a payout paid from its own page: a transfer reference is required.')
  if (summary.truncated) parts.push('Row cap reached — totals are a floor, not the full backlog.')
  return parts.join(' ')
}

export default async function PayoutQueueWidget(props: WidgetServerProps) {
  const { req } = props
  const title = 'Payouts to send'

  // The dashboard is admin-only already, but this widget exposes other partners' account numbers,
  // so it re-checks rather than inheriting that guarantee.
  if (req.user?.role !== 'admin') {
    return (
      <ChartCard title={title}>
        <EmptyState message="Payout processing is available to admin accounts only." />
      </ChartCard>
    )
  }

  let summary: PayoutQueueSummary
  try {
    summary = await loadPayoutQueue(req.payload, { req })
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `Dashboard widget failed: ${title}` })
    return (
      <ChartCard title={title}>
        <EmptyState message="Could not load the payout queue. Check the server logs for details." />
      </ChartCard>
    )
  }

  const adminRoute = req.payload.config.routes.admin
  const shown = summary.rows.slice(0, ROWS_SHOWN)
  const hidden = summary.outstandingCount - shown.length

  return (
    <ChartCard
      title={title}
      meta={
        summary.outstandingCount > 0
          ? `${formatCount(summary.outstandingCount)} open · ${formatTaka(summary.outstandingTotal)}`
          : 'Queue clear'
      }
      subtitle={
        summary.oldestAgeDays != null && summary.oldestAgeDays > 0
          ? `Longest wait: ${summary.oldestAgeDays} days.`
          : 'Requests partners have filed but not been paid for yet.'
      }
      footnote={summary.outstandingCount > 0 ? footnote(summary, hidden) : undefined}
    >
      {summary.outstandingCount === 0 ? (
        <EmptyState message="No payout requests waiting. Anything partners file will appear here." />
      ) : (
        <QueueTable rows={shown} adminRoute={adminRoute} />
      )}
    </ChartCard>
  )
}

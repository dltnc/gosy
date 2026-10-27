import React from 'react'

import type { GatewaySlice } from '@/lib/analytics/types'
import { ChartDataTable, DONUT_PALETTE, EmptyState, formatPct, formatTaka } from './chart-kit'

const SIZE = 160
const RADIUS = 62
const STROKE = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Payment gateway mix.
 *
 * Slices are sized by money successfully collected, not by attempts, so the ring adds up to
 * revenue actually banked. The success rate sits beside each label because a gateway can carry
 * plenty of traffic while quietly failing a third of it.
 */
export function GatewayDonutChart({ slices }: { slices: GatewaySlice[] }) {
  const withValue = slices.filter((slice) => slice.amount > 0)
  if (!withValue.length) {
    return <EmptyState message="No successful booking payments in this window." />
  }

  const total = withValue.reduce((sum, slice) => sum + slice.amount, 0)

  // Arc geometry is resolved up front: each slice needs the cumulative length of the ones before
  // it, and accumulating that inside the render callback would mutate state mid-render.
  const arcs = withValue.reduce<{ slice: GatewaySlice; dash: number; offset: number }[]>(
    (acc, slice) => {
      const previous = acc[acc.length - 1]
      const offset = previous ? previous.offset + previous.dash : 0
      return [...acc, { slice, dash: (slice.amount / total) * CIRCUMFERENCE, offset }]
    },
    [],
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`Payments collected by gateway, total ${formatTaka(total)}`}
        style={{ flexShrink: 0 }}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map(({ slice, dash, offset }, index) => (
            <circle
              key={slice.key}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={DONUT_PALETTE[index % DONUT_PALETTE.length]}
              strokeWidth={STROKE}
              strokeDasharray={`${dash.toFixed(2)} ${(CIRCUMFERENCE - dash).toFixed(2)}`}
              strokeDashoffset={-offset}
            >
              <title>
                {`${slice.label}: ${formatTaka(slice.amount)} (${formatPct((slice.amount / total) * 100)})`}
              </title>
            </circle>
          ))}
        </g>
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 2}
          textAnchor="middle"
          style={{ fill: 'var(--theme-text)', fontSize: 15, fontWeight: 600 }}
        >
          {formatTaka(total)}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 14}
          textAnchor="middle"
          style={{ fill: 'var(--theme-elevation-450)', fontSize: 9 }}
        >
          collected
        </text>
      </svg>

      <ul
        style={{
          flex: 1,
          minWidth: 180,
          margin: 0,
          padding: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 12,
        }}
        aria-hidden="true"
      >
        {withValue.map((slice, index) => (
          <li key={slice.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                flexShrink: 0,
                background: DONUT_PALETTE[index % DONUT_PALETTE.length],
              }}
            />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {slice.label}
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatTaka(slice.amount)}</span>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                color:
                  slice.successRatePct < 70
                    ? 'var(--theme-error-500)'
                    : 'var(--theme-elevation-400)',
                minWidth: 42,
                textAlign: 'right',
              }}
              title={`${slice.successes} of ${slice.attempts} attempts succeeded`}
            >
              {formatPct(slice.successRatePct, 0)}
            </span>
          </li>
        ))}
      </ul>

      <ChartDataTable
        caption="Payments collected by gateway"
        columns={['Gateway', 'Collected', 'Attempts', 'Successes', 'Success rate']}
        rows={slices.map((slice) => [
          slice.label,
          formatTaka(slice.amount),
          slice.attempts,
          slice.successes,
          formatPct(slice.successRatePct, 0),
        ])}
      />
    </div>
  )
}

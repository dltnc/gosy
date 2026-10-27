import React from 'react'

import type { FunnelStage } from '@/lib/analytics/types'
import { ChartDataTable, EmptyState, SERIES, formatCount, formatPct } from './chart-kit'

const WIDTH = 420
const STAGE_H = 44
const GAP = 4
const MAX_HALF = 150

const STAGE_COLORS = ['#3d7bd9', '#3f8fd0', '#2fa39a', '#00a698']

/**
 * Reservation progression drawn as a true funnel.
 *
 * Each band is sized by the share of reservations that reached that stage. Because bookings
 * store only their current status, a reservation that was paid and then cancelled cannot be
 * distinguished from one cancelled before payment, so "Payment cleared" is a lower bound.
 */
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const top = stages[0]?.value ?? 0
  if (!top) return <EmptyState message="No reservations were created in this window." />

  const height = stages.length * STAGE_H + (stages.length - 1) * GAP
  const cx = WIDTH / 2
  const halfWidth = (value: number) => Math.max(6, (value / top) * MAX_HALF)

  return (
    <>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={`Reservation funnel from ${formatCount(top)} reservations created down to ${formatCount(stages[stages.length - 1]?.value ?? 0)} completed stays`}
        style={{ display: 'block' }}
      >
        {stages.map((stage, index) => {
          const y = index * (STAGE_H + GAP)
          const topHalf = halfWidth(stage.value)
          const next = stages[index + 1]
          const bottomHalf = next ? halfWidth(next.value) : topHalf
          const points = [
            `${cx - topHalf},${y}`,
            `${cx + topHalf},${y}`,
            `${cx + bottomHalf},${y + STAGE_H}`,
            `${cx - bottomHalf},${y + STAGE_H}`,
          ].join(' ')

          return (
            <g key={stage.key}>
              <polygon
                points={points}
                fill={STAGE_COLORS[index % STAGE_COLORS.length]}
                fillOpacity={0.9}
              >
                <title>
                  {`${stage.label}: ${formatCount(stage.value)} (${formatPct(stage.pct)} of reservations created)`}
                </title>
              </polygon>
              <text
                x={cx}
                y={y + STAGE_H / 2 - 2}
                textAnchor="middle"
                style={{ fill: '#ffffff', fontSize: 11, fontWeight: 600 }}
              >
                {formatCount(stage.value)}
              </text>
              <text
                x={cx}
                y={y + STAGE_H / 2 + 11}
                textAnchor="middle"
                style={{ fill: 'rgba(255,255,255,0.85)', fontSize: 9 }}
              >
                {stage.label}
              </text>
              <text
                x={WIDTH - 4}
                y={y + STAGE_H / 2 + 3}
                textAnchor="end"
                style={{ fill: 'var(--theme-elevation-450)', fontSize: 10 }}
              >
                {formatPct(stage.pct, 0)}
              </text>
            </g>
          )
        })}
      </svg>

      <ChartDataTable
        caption="Reservation funnel"
        columns={['Stage', 'Reservations', 'Share of created']}
        rows={stages.map((stage) => [stage.label, formatCount(stage.value), formatPct(stage.pct)])}
      />
    </>
  )
}

/** Where reservations stalled or fell out, by current status. */
export function LeakageList({ stages }: { stages: FunnelStage[] }) {
  const shown = stages.filter((stage) => stage.value > 0)
  if (!shown.length) return null

  return (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 16px',
        margin: 0,
        padding: 0,
        listStyle: 'none',
        fontSize: 11,
        color: 'var(--theme-elevation-500)',
      }}
    >
      {shown.map((stage) => (
        <li key={stage.key}>
          <span style={{ color: 'var(--theme-elevation-700)', fontWeight: 600 }}>
            {formatCount(stage.value)}
          </span>{' '}
          {stage.label}
          <span style={{ color: SERIES.muted }}> ({formatPct(stage.pct, 0)})</span>
        </li>
      ))}
    </ul>
  )
}

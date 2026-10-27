import React from 'react'

import type { TimeBucket } from '@/lib/analytics/types'
import {
  ChartDataTable,
  EmptyState,
  SERIES,
  axisLabelStyle,
  formatCount,
  formatTaka,
  formatTakaCompact,
  niceMax,
} from './chart-kit'

const WIDTH = 720
const HEIGHT = 260
const PAD = { top: 12, right: 48, bottom: 28, left: 52 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom
const GRID_LINES = 4

/**
 * Gross booking value as bars with cash-collected and commission as lines.
 *
 * Two value axes: the left carries GBV and net cash, the right carries commission. Commission
 * runs at roughly a tenth of GBV, so plotting it on the shared axis would flatten it into the
 * baseline and hide exactly the trend the chart exists to show.
 */
export function GbvComboChart({ buckets }: { buckets: TimeBucket[] }) {
  if (!buckets.length) return <EmptyState message="No reservations in this window yet." />

  const leftMax = niceMax(Math.max(...buckets.map((b) => Math.max(b.gbv, b.netCash)), 1))
  const rightMax = niceMax(Math.max(...buckets.map((b) => b.commission), 1))

  const slot = PLOT_W / buckets.length
  const barWidth = Math.max(2, Math.min(28, slot * 0.55))
  const centerOf = (index: number) => PAD.left + slot * (index + 0.5)
  const yLeft = (value: number) => PAD.top + PLOT_H - (value / leftMax) * PLOT_H
  const yRight = (value: number) => PAD.top + PLOT_H - (value / rightMax) * PLOT_H

  const labelStep = Math.max(1, Math.ceil(buckets.length / 8))
  const netCashPoints = buckets
    .map((bucket, index) => `${centerOf(index).toFixed(1)},${yLeft(bucket.netCash).toFixed(1)}`)
    .join(' ')
  const commissionPoints = buckets
    .map((bucket, index) => `${centerOf(index).toFixed(1)},${yRight(bucket.commission).toFixed(1)}`)
    .join(' ')

  return (
    <>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={`Gross booking value, cash collected and commission across ${buckets.length} periods`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {Array.from({ length: GRID_LINES + 1 }, (_, i) => {
          const value = (leftMax / GRID_LINES) * i
          const y = yLeft(value)
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={y}
                y2={y}
                stroke="var(--theme-elevation-100)"
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" style={axisLabelStyle}>
                {formatTakaCompact(value)}
              </text>
              <text x={PAD.left + PLOT_W + 6} y={y + 3} style={axisLabelStyle}>
                {formatTakaCompact((rightMax / GRID_LINES) * i)}
              </text>
            </g>
          )
        })}

        {buckets.map((bucket, index) => {
          const height = Math.max(0, PAD.top + PLOT_H - yLeft(bucket.gbv))
          return (
            <g key={bucket.key}>
              <rect
                x={centerOf(index) - barWidth / 2}
                y={yLeft(bucket.gbv)}
                width={barWidth}
                height={height}
                rx={2}
                fill={SERIES.gbv}
                fillOpacity={0.85}
              >
                <title>
                  {`${bucket.label} · GBV ${formatTaka(bucket.gbv)} · ${formatCount(bucket.bookings)} reservations`}
                </title>
              </rect>
              {index % labelStep === 0 ? (
                <text
                  x={centerOf(index)}
                  y={HEIGHT - 10}
                  textAnchor="middle"
                  style={axisLabelStyle}
                >
                  {bucket.label}
                </text>
              ) : null}
            </g>
          )
        })}

        <polyline
          points={netCashPoints}
          fill="none"
          stroke={SERIES.netCash}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={commissionPoints}
          fill="none"
          stroke={SERIES.commission}
          strokeWidth={2}
          strokeDasharray="5 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {buckets.map((bucket, index) => (
          <g key={`p-${bucket.key}`}>
            <circle cx={centerOf(index)} cy={yLeft(bucket.netCash)} r={2.5} fill={SERIES.netCash}>
              <title>{`${bucket.label} · Cash collected ${formatTaka(bucket.netCash)}`}</title>
            </circle>
            <circle
              cx={centerOf(index)}
              cy={yRight(bucket.commission)}
              r={2.5}
              fill={SERIES.commission}
            >
              <title>{`${bucket.label} · Commission ${formatTaka(bucket.commission)}`}</title>
            </circle>
          </g>
        ))}

        <line
          x1={PAD.left}
          x2={PAD.left + PLOT_W}
          y1={PAD.top + PLOT_H}
          y2={PAD.top + PLOT_H}
          stroke="var(--theme-elevation-200)"
          strokeWidth={1}
        />
      </svg>

      <ChartDataTable
        caption="Gross booking value, cash collected and commission by period"
        columns={['Period', 'GBV', 'Cash collected', 'Commission', 'Reservations', 'Cancelled']}
        rows={buckets.map((bucket) => [
          bucket.label,
          formatTaka(bucket.gbv),
          formatTaka(bucket.netCash),
          formatTaka(bucket.commission),
          formatCount(bucket.bookings),
          formatCount(bucket.cancelled),
        ])}
      />
    </>
  )
}

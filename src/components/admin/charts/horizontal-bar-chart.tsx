import React from 'react'

import { ChartDataTable, EmptyState } from './chart-kit'

export interface BarSegment {
  label: string
  value: number
  color: string
}

export interface BarRow {
  key: string
  label: string
  segments: BarSegment[]
  /** Right-hand figure, already formatted (e.g. "৳1.2L" or "12.5%"). */
  valueLabel: string
  /** Optional second figure shown under the label, e.g. a count. */
  subLabel?: string
}

/**
 * Horizontal bars, built from CSS rather than SVG.
 *
 * Category names in this dataset are long (room type names, city names), and horizontal bars
 * give them room without rotated axis labels. `scale: 'row'` makes each bar its own 100%, which
 * is what occupancy needs; `scale: 'shared'` compares magnitudes across rows.
 */
export function HorizontalBarChart({
  rows,
  scale = 'shared',
  caption,
  columns,
  emptyMessage = 'Nothing to show for this window.',
}: {
  rows: BarRow[]
  scale?: 'row' | 'shared'
  caption: string
  columns: string[]
  emptyMessage?: string
}) {
  if (!rows.length) return <EmptyState message={emptyMessage} />

  const totals = rows.map((row) => row.segments.reduce((sum, seg) => sum + seg.value, 0))
  const sharedMax = Math.max(...totals, 1)

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-hidden="true">
        {rows.map((row, rowIndex) => {
          const max = scale === 'row' ? Math.max(totals[rowIndex], 1) : sharedMax
          return (
            <div
              key={row.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(72px, 30%) 1fr auto',
                alignItems: 'center',
                gap: 10,
                fontSize: 12,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--theme-text)',
                  }}
                  title={row.label}
                >
                  {row.label}
                </div>
                {row.subLabel ? (
                  <div style={{ fontSize: 10, color: 'var(--theme-elevation-400)' }}>
                    {row.subLabel}
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  display: 'flex',
                  height: 14,
                  borderRadius: 3,
                  overflow: 'hidden',
                  background: 'var(--theme-elevation-50)',
                }}
              >
                {row.segments.map((segment) => (
                  <div
                    key={segment.label}
                    title={`${row.label} · ${segment.label}: ${segment.value.toLocaleString('en-US')}`}
                    style={{
                      width: `${Math.max(0, (segment.value / max) * 100)}%`,
                      background: segment.color,
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--theme-elevation-700)',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.valueLabel}
              </div>
            </div>
          )
        })}
      </div>

      <ChartDataTable
        caption={caption}
        columns={columns}
        rows={rows.map((row) => [
          row.label,
          ...row.segments.map((segment) => segment.value.toLocaleString('en-US')),
          row.valueLabel,
        ])}
      />
    </>
  )
}

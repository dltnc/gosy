/**
 * Chart primitives for the Payload admin dashboard.
 *
 * These are plain server components: no `use client`, no charting dependency, no client JS at
 * all. Hover text is provided by native SVG `<title>` elements, which the browser renders as
 * tooltips for free. Colours come from Payload's own theme custom properties wherever possible
 * so the widgets follow the admin light/dark themes, with a small explicit series palette for
 * the data itself.
 *
 * The approach follows the existing hand-rolled `features/partner/components/revenue-chart.tsx`
 * rather than introducing a chart library.
 */
import React from 'react'

export const SERIES = {
  gbv: '#3d7bd9',
  netCash: '#00a698',
  commission: '#e0563f',
  muted: '#8a94a6',
  guest: '#e0563f',
  partner: '#e2a33c',
  noShow: '#8a94a6',
  booked: '#3d7bd9',
  available: 'rgba(138, 148, 166, 0.28)',
} as const

export const DONUT_PALETTE = [
  '#3d7bd9',
  '#00a698',
  '#e0563f',
  '#e2a33c',
  '#7a6fd1',
  '#4aa3c4',
  '#8a94a6',
] as const

export function formatTaka(value: number): string {
  return `৳${Math.round(value).toLocaleString('en-US')}`
}

/** Compact axis/label form using the lakh–crore scale familiar in this market. */
export function formatTakaCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 10_000_000) return `৳${(value / 10_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}Cr`
  if (abs >= 100_000) return `৳${(value / 100_000).toFixed(abs >= 1_000_000 ? 0 : 1)}L`
  if (abs >= 1_000) return `৳${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return `৳${Math.round(value)}`
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

/** Round an axis maximum up to a friendly number so gridlines land on readable values. */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const normalized = value / magnitude
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10
  return step * magnitude
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'calc(var(--base, 24px) * 0.5)',
  height: '100%',
  padding: 'calc(var(--base, 24px) * 0.75)',
  border: '1px solid var(--theme-elevation-150)',
  borderRadius: 'var(--style-radius-m, 6px)',
  background: 'var(--theme-elevation-0)',
  color: 'var(--theme-text)',
  boxSizing: 'border-box',
}

export interface ChartCardProps {
  title: string
  subtitle?: string
  /** Small right-aligned note, typically the active date range. */
  meta?: string
  /** Methodology caveat shown under the chart in small print. */
  footnote?: string
  legend?: { color: string; label: string }[]
  children: React.ReactNode
}

export function ChartCard({ title, subtitle, meta, footnote, legend, children }: ChartCardProps) {
  return (
    <section style={cardStyle}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        {meta ? (
          <span
            style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--theme-elevation-500)' }}
          >
            {meta}
          </span>
        ) : null}
        {subtitle ? (
          <p
            style={{
              flexBasis: '100%',
              margin: 0,
              fontSize: 12,
              lineHeight: 1.45,
              color: 'var(--theme-elevation-500)',
            }}
          >
            {subtitle}
          </p>
        ) : null}
      </header>

      {legend?.length ? <Legend items={legend} /> : null}

      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>

      {footnote ? (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.4,
            color: 'var(--theme-elevation-400)',
          }}
        >
          {footnote}
        </p>
      ) : null}
    </section>
  )
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px 14px',
        margin: 0,
        padding: 0,
        listStyle: 'none',
        fontSize: 11,
        color: 'var(--theme-elevation-600)',
      }}
    >
      {items.map((item) => (
        <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: item.color,
              flexShrink: 0,
            }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <p
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 120,
        margin: 0,
        padding: 16,
        fontSize: 12,
        textAlign: 'center',
        color: 'var(--theme-elevation-400)',
        border: '1px dashed var(--theme-elevation-150)',
        borderRadius: 'var(--style-radius-s, 4px)',
      }}
    >
      {message}
    </p>
  )
}

const srOnly: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/**
 * Screen-reader-only tabular equivalent of a chart.
 *
 * An SVG plot is meaningless to assistive tech no matter how it is labelled, so every chart in
 * this dashboard pairs its visual with the same numbers as a real table.
 */
export function ChartDataTable({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: (number | string)[][]
}) {
  return (
    <table style={srOnly}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${String(row[0])}-${rowIndex}`}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={cellIndex}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export const axisLabelStyle: React.CSSProperties = {
  fill: 'var(--theme-elevation-450)',
  fontSize: 9,
}

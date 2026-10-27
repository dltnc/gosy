import React from 'react'
import type { WidgetServerProps } from 'payload'

import {
  ChartCard,
  SERIES,
  formatCount,
  formatTaka,
  formatTakaCompact,
} from '@/components/admin/charts/chart-kit'
import { HorizontalBarChart } from '@/components/admin/charts/horizontal-bar-chart'
import { resolveWidget, truncationNote } from './widget-shell'

/**
 * Revenue by room type.
 *
 * Room types belong to individual properties, so names repeat across the marketplace ("Deluxe"
 * exists many times over). Each bar is therefore one property's room type, ranked by gross
 * revenue, with the tail folded into a single "Other" bar. Cancelled reservations are excluded.
 */
export default async function RoomTypeRevenueWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Revenue by room type')
  if (!resolution.ok) return resolution.node

  const { roomTypeRevenue, range, truncated } = resolution.data

  const rows = roomTypeRevenue.map((entry) => ({
    key: entry.key,
    label: entry.label,
    subLabel: `${formatCount(entry.bookings)} bookings · ADR ${formatTakaCompact(entry.adr)}`,
    valueLabel: formatTakaCompact(entry.revenue),
    segments: [{ label: 'Gross revenue', value: entry.revenue, color: SERIES.gbv }],
  }))

  const total = roomTypeRevenue.reduce((sum, entry) => sum + entry.revenue, 0)

  return (
    <ChartCard
      title="Revenue by room type"
      meta={range.label}
      subtitle={`Gross booking value per room type — ${formatTaka(total)} across the window.`}
      footnote={`Excludes cancelled and no-show reservations. Room types are per-property, so similar names can appear more than once.${truncationNote(truncated)}`}
    >
      <HorizontalBarChart
        rows={rows}
        caption="Gross revenue by room type"
        columns={['Room type', 'Gross revenue', 'Total']}
        emptyMessage="No completed or live reservations in this window."
      />
    </ChartCard>
  )
}

import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard, SERIES, formatCount, formatPct } from '@/components/admin/charts/chart-kit'
import { HorizontalBarChart } from '@/components/admin/charts/horizontal-bar-chart'
import { resolveWidget, truncationNote } from './widget-shell'

/**
 * Booked versus available room-nights by city.
 *
 * This is the one widget measured on **stay dates** rather than reservation dates — a room-night
 * can only be consumed on the night it happens, so counting it at booking time would be
 * meaningless. Availability is active rooms in the city multiplied by nights in the window, which
 * assumes every room is sellable every night and so reads slightly optimistic where partners take
 * rooms offline without deactivating them.
 */
export default async function CityOccupancyWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Occupancy by city')
  if (!resolution.ok) return resolution.node

  const { cityOccupancy, range, truncated } = resolution.data

  const rows = cityOccupancy.map((city) => ({
    key: city.key,
    label: city.label,
    subLabel: `${formatCount(city.properties)} properties · ${formatCount(city.rooms)} rooms`,
    valueLabel: formatPct(city.occupancyPct, 1),
    segments: [
      { label: 'Room-nights booked', value: city.roomNightsBooked, color: SERIES.booked },
      {
        label: 'Room-nights unsold',
        value: Math.max(0, city.roomNightsAvailable - city.roomNightsBooked),
        color: SERIES.available,
      },
    ],
  }))

  return (
    <ChartCard
      title="Occupancy by city"
      meta={range.label}
      subtitle="Room-nights sold against room-nights available, for stays falling inside the window."
      legend={[
        { color: SERIES.booked, label: 'Booked' },
        { color: '#c9ced8', label: 'Available' },
      ]}
      footnote={`Counted on stay dates, unlike the revenue widgets. Only approved properties and active rooms count as supply.${truncationNote(truncated)}`}
    >
      <HorizontalBarChart
        rows={rows}
        scale="row"
        caption="Room-nights booked against available, by city"
        columns={['City', 'Room-nights booked', 'Room-nights unsold', 'Occupancy']}
        emptyMessage="No approved properties with active rooms yet."
      />
    </ChartCard>
  )
}

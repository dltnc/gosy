import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard, SERIES } from '@/components/admin/charts/chart-kit'
import { GbvComboChart } from '@/components/admin/charts/combo-chart'
import { resolveWidget, truncationNote } from './widget-shell'

/**
 * Gross platform volume over time.
 *
 * Every reservation lands in the bucket for the day it was **created**, so a booking made today
 * for a December stay counts today. Buckets are cut on Asia/Dhaka calendar days rather than UTC,
 * which matters because reservations placed between midnight and 06:00 local time are stored as
 * the previous UTC day.
 */
export default async function GbvTrendWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Gross platform volume')
  if (!resolution.ok) return resolution.node

  const { buckets, range, kpis, truncated } = resolution.data

  return (
    <ChartCard
      title="Gross platform volume"
      meta={range.label}
      subtitle="Booking value, cash collected and platform commission by reservation date."
      legend={[
        { color: SERIES.gbv, label: 'GBV (bars, left axis)' },
        { color: SERIES.netCash, label: 'Cash collected (left axis)' },
        { color: SERIES.commission, label: 'Commission (right axis)' },
      ]}
      footnote={`Cancelled and no-show reservations still count towards GBV but not towards cash or commission.${truncationNote(truncated)}`}
    >
      <GbvComboChart buckets={buckets} />
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          color: 'var(--theme-elevation-500)',
        }}
      >
        {`Bucketed by ${range.granularity}. Cancelled reservations account for `}
        <strong style={{ color: 'var(--theme-elevation-700)' }}>
          {`${kpis.cancellationRatePct.toFixed(1)}%`}
        </strong>
        {' of volume in this window.'}
      </p>
    </ChartCard>
  )
}

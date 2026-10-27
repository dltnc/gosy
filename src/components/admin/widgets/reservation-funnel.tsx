import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard } from '@/components/admin/charts/chart-kit'
import { FunnelChart, LeakageList } from '@/components/admin/charts/funnel-chart'
import { resolveWidget, truncationNote } from './widget-shell'

/**
 * How far reservations get.
 *
 * This is deliberately *not* labelled Search → Click → Book. Nothing in the app records searches,
 * property views or sessions, so a top-of-funnel stage would be invented. What can be measured
 * honestly starts at the reservation itself and follows the booking status machine down to a
 * completed stay.
 */
export default async function ReservationFunnelWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Reservation funnel')
  if (!resolution.ok) return resolution.node

  const { funnel, leakage, range, truncated } = resolution.data

  return (
    <ChartCard
      title="Reservation funnel"
      meta={range.label}
      subtitle="Current state of every reservation created in this window."
      footnote={`Bookings store only their current status, so a reservation cancelled after payment is indistinguishable from one cancelled before it — "Payment cleared" is therefore a lower bound.${truncationNote(truncated)}`}
    >
      <FunnelChart stages={funnel} />
      <div style={{ marginTop: 10 }}>
        <LeakageList stages={leakage} />
      </div>
    </ChartCard>
  )
}

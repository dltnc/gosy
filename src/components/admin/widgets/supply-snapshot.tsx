import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard, formatCount } from '@/components/admin/charts/chart-kit'
import { StatTiles } from '@/components/admin/charts/stat-tiles'
import type { StatTile } from '@/components/admin/charts/stat-tiles'
import { resolveWidget } from './widget-shell'

/**
 * Current supply position.
 *
 * Deliberately a set of counters rather than the cumulative area chart that would normally show
 * supply growth. No collection in this app has versions enabled, so there is no record of what
 * supply looked like in the past. Backdating today's listings by `createdAt` would draw a curve
 * that quietly erases every property that was later suspended or removed — it would show the
 * marketplace as having only ever grown. A growth chart needs a nightly snapshot job first.
 */
export default async function SupplySnapshotWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Supply position')
  if (!resolution.ok) return resolution.node

  const { supply } = resolution.data

  const tiles: StatTile[] = [
    {
      key: 'approved',
      label: 'Live properties',
      value: formatCount(supply.approvedProperties),
      help: `across ${formatCount(supply.citiesCovered)} cities`,
    },
    {
      key: 'rooms',
      label: 'Bookable rooms',
      value: formatCount(supply.activeRooms),
      help: `${formatCount(supply.activeRoomTypes)} room types`,
    },
    {
      key: 'pending',
      label: 'Awaiting review',
      value: formatCount(supply.pendingProperties),
      help: supply.pendingProperties > 0 ? 'partner listings queued' : 'queue clear',
      tone: supply.pendingProperties > 0 ? 'warning' : 'positive',
    },
    {
      key: 'suspended',
      label: 'Suspended',
      value: formatCount(supply.suspendedProperties),
      help: 'removed from search',
      tone: supply.suspendedProperties > 0 ? 'negative' : 'default',
    },
  ]

  return (
    <ChartCard
      title="Supply position"
      meta="As of now"
      subtitle="Live inventory on the marketplace."
      footnote="Point-in-time counts. Supply growth over time needs historical snapshots, which are not recorded yet."
    >
      <StatTiles tiles={tiles} />
    </ChartCard>
  )
}

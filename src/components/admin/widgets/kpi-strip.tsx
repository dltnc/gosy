import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard, formatCount, formatPct, formatTaka } from '@/components/admin/charts/chart-kit'
import { StatTiles } from '@/components/admin/charts/stat-tiles'
import type { StatTile } from '@/components/admin/charts/stat-tiles'
import { resolveWidget, truncationNote } from './widget-shell'

/**
 * Marketplace KPI strip.
 *
 * Two things worth knowing about these numbers:
 *
 * - Take rate is commission over **gross** subtotal, because `computePricing` charges commission
 *   on the pre-discount subtotal while the guest pays the discounted total. The effective rate
 *   shown alongside it (commission over cash collected) is the one that reflects reality — the
 *   gap between the two is the discount the platform is absorbing.
 * - ADR and RevPAR are calculated over reservations *created* in the window, matching the GBV
 *   convention, so they answer "what did we sell this period", not "what was occupied".
 */
export default async function KpiStripWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Marketplace KPIs')
  if (!resolution.ok) return resolution.node

  const { kpis, range, configuredCommissionRate, truncated } = resolution.data
  const rateDrift = kpis.takeRatePct - configuredCommissionRate

  const tiles: StatTile[] = [
    {
      key: 'gbv',
      label: 'Gross booking value',
      value: formatTaka(kpis.gbv),
      help: `${formatCount(kpis.bookings)} reservations created`,
    },
    {
      key: 'commission',
      label: 'Commission revenue',
      value: formatTaka(kpis.commission),
      help: `${formatTaka(kpis.netCash)} cash collected`,
    },
    {
      key: 'take-rate',
      label: 'Take rate',
      value: formatPct(kpis.takeRatePct),
      help:
        Math.abs(rateDrift) < 0.05
          ? `matches the ${formatPct(configuredCommissionRate, 0)} platform default`
          : `${rateDrift > 0 ? '+' : ''}${rateDrift.toFixed(1)}pt vs ${formatPct(configuredCommissionRate, 0)} default`,
      tone: Math.abs(rateDrift) < 0.05 ? 'default' : 'warning',
    },
    {
      key: 'effective-take-rate',
      label: 'Effective take rate',
      value: formatPct(kpis.effectiveTakeRatePct),
      help: `${formatTaka(kpis.discountGiven)} of discount absorbed`,
    },
    {
      key: 'adr',
      label: 'ADR',
      value: formatTaka(kpis.adr),
      help: `${formatCount(kpis.roomNightsSold)} room-nights sold`,
    },
    {
      key: 'revpar',
      label: 'RevPAR',
      value: formatTaka(kpis.revpar),
      help: `${formatPct(kpis.occupancyPct)} of ${formatCount(kpis.roomNightsAvailable)} available`,
    },
    {
      key: 'cancellation',
      label: 'Cancellation rate',
      value: formatPct(kpis.cancellationRatePct),
      help: `${formatCount(kpis.cancellations)} cancelled or no-show`,
      tone: kpis.cancellationRatePct > 20 ? 'negative' : 'default',
    },
  ]

  return (
    <ChartCard
      title="Marketplace KPIs"
      meta={range.label}
      subtitle="Reservations counted at the date they were booked, not the date of stay."
      footnote={`Take rate is commission over gross subtotal; the effective rate is commission over cash actually collected.${truncationNote(truncated)}`}
    >
      <StatTiles tiles={tiles} />
    </ChartCard>
  )
}

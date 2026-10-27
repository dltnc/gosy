import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard, SERIES, formatCount, formatPct } from '@/components/admin/charts/chart-kit'
import { HorizontalBarChart } from '@/components/admin/charts/horizontal-bar-chart'
import type { BarRow } from '@/components/admin/charts/horizontal-bar-chart'
import type { CancellationGroup } from '@/lib/analytics/types'
import { resolveWidget, truncationNote } from './widget-shell'

function toRows(groups: CancellationGroup[]): BarRow[] {
  return groups
    .filter((group) => group.total > 0)
    .map((group) => ({
      key: group.key,
      label: group.label,
      subLabel: `${formatCount(group.total)} reservations`,
      valueLabel: formatPct(group.cancellationRatePct, 1),
      segments: [
        { label: 'Cancelled by guest', value: group.cancelledByGuest, color: SERIES.guest },
        { label: 'Cancelled by partner', value: group.cancelledByPartner, color: SERIES.partner },
        { label: 'No-show', value: group.noShow, color: SERIES.noShow },
      ],
    }))
}

/**
 * Cancellation dynamics.
 *
 * Grouped by tier rather than property type: only two property types exist (hotel and resort),
 * which makes for a chart with nothing to say. The second grouping uses the `free_cancellation`
 * trust badge, the only structured signal available — `policies.cancellationPolicy` is free text.
 *
 * Bars are scaled per row so the three causes are comparable within a group; the figure on the
 * right is the combined rate.
 */
export default async function CancellationBreakdownWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Cancellation dynamics')
  if (!resolution.ok) return resolution.node

  const { cancellationByTier, cancellationByPolicy, range, truncated } = resolution.data
  const tierRows = toRows(cancellationByTier)
  const policyRows = toRows(cancellationByPolicy)

  return (
    <ChartCard
      title="Cancellation dynamics"
      meta={range.label}
      subtitle="Share of reservations cancelled or no-showed, by property tier and cancellation policy."
      legend={[
        { color: SERIES.guest, label: 'By guest' },
        { color: SERIES.partner, label: 'By partner' },
        { color: SERIES.noShow, label: 'No-show' },
      ]}
      footnote={`Bars are scaled within each row, so lengths compare causes inside a group rather than volumes across groups.${truncationNote(truncated)}`}
    >
      <HorizontalBarChart
        rows={tierRows}
        scale="row"
        caption="Cancellations by property tier"
        columns={['Tier', 'By guest', 'By partner', 'No-show', 'Cancellation rate']}
        emptyMessage="No reservations with a resolvable property tier in this window."
      />

      <p
        style={{
          margin: '14px 0 8px',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--theme-elevation-450)',
        }}
      >
        By cancellation policy
      </p>
      <HorizontalBarChart
        rows={policyRows}
        scale="row"
        caption="Cancellations by cancellation policy"
        columns={['Policy', 'By guest', 'By partner', 'No-show', 'Cancellation rate']}
        emptyMessage="No reservations to compare by policy in this window."
      />
    </ChartCard>
  )
}

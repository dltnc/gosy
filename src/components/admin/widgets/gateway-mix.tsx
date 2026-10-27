import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard } from '@/components/admin/charts/chart-kit'
import { GatewayDonutChart } from '@/components/admin/charts/donut-chart'
import { resolveWidget, truncationNote } from './widget-shell'

/**
 * Payment gateway mix.
 *
 * This is the closest thing to a demand-channel chart that existing data supports. There is no
 * middleware, no UTM capture and no session logging anywhere in the app, so traffic source is
 * simply not recorded — a "direct vs paid search vs affiliate" donut would be fabricated. What is
 * recorded is how guests paid, which at least shows where checkout succeeds and where it fails.
 */
export default async function GatewayMixWidget(props: WidgetServerProps) {
  const resolution = await resolveWidget(props, 'Payment mix')
  if (!resolution.ok) return resolution.node

  const { gatewayMix, range, truncated } = resolution.data
  const failing = gatewayMix.filter((slice) => slice.attempts >= 5 && slice.successRatePct < 70)

  return (
    <ChartCard
      title="Payment mix"
      meta={range.label}
      subtitle="Money collected per gateway, with the success rate of each."
      footnote={`Traffic source is not recorded anywhere in the app, so this stands in for a demand-channel breakdown.${truncationNote(truncated)}`}
    >
      <GatewayDonutChart slices={gatewayMix} />
      {failing.length ? (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 11,
            color: 'var(--theme-error-500)',
          }}
        >
          {`Low success rate: ${failing.map((slice) => `${slice.label} (${slice.successRatePct.toFixed(0)}%)`).join(', ')}.`}
        </p>
      ) : null}
    </ChartCard>
  )
}

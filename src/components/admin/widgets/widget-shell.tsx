import React from 'react'
import type { WidgetServerProps } from 'payload'

import { ChartCard, EmptyState } from '@/components/admin/charts/chart-kit'
import { loadDashboardData, resolvePresetFromWidgetData } from '@/lib/analytics/dashboard'
import type { DashboardData } from '@/lib/analytics/dashboard'

export type WidgetResolution =
  { data: DashboardData; ok: true } | { node: React.ReactElement; ok: false }

/**
 * Shared entry point for every dashboard widget.
 *
 * Three things happen here that are easy to get wrong per-widget:
 *
 * 1. **Role gate.** `Users.access.admin` already limits the panel to admins, but these widgets
 *    expose platform-wide revenue, so they refuse to render for anyone else rather than relying
 *    on a single upstream check.
 * 2. **Failure isolation.** A widget that throws would take the whole dashboard down with it.
 *    Aggregation reads a lot of rows, so each widget degrades to a message instead.
 * 3. **Range resolution** from the widget's own settings form, defaulting to 30 days.
 */
export async function resolveWidget(
  props: WidgetServerProps,
  title: string,
): Promise<WidgetResolution> {
  const { req, widgetData } = props

  if (req.user?.role !== 'admin') {
    return {
      ok: false,
      node: (
        <ChartCard title={title}>
          <EmptyState message="Platform analytics are available to admin accounts only." />
        </ChartCard>
      ),
    }
  }

  try {
    const data = await loadDashboardData(req.payload, resolvePresetFromWidgetData(widgetData))
    return { ok: true, data }
  } catch (error) {
    req.payload.logger.error({ err: error, msg: `Dashboard widget failed: ${title}` })
    return {
      ok: false,
      node: (
        <ChartCard title={title}>
          <EmptyState message="Could not load analytics. Check the server logs for details." />
        </ChartCard>
      ),
    }
  }
}

/** Note appended to any widget whose numbers were capped by the row limit. */
export function truncationNote(truncated: boolean): string {
  return truncated
    ? ' Row cap reached for this window — figures are a partial view; narrow the range.'
    : ''
}

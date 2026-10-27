import type { DashboardConfig, Field, Widget } from 'payload'

import { RANGE_PRESETS } from '../lib/analytics/range'

/**
 * Marketplace dashboard widgets.
 *
 * Every widget reads from `src/lib/analytics` and is a React Server Component, so nothing here
 * ships to the browser. All revenue widgets bucket on `bookings.createdAt` (reservation date), not
 * stay date — the one exception is occupancy, which has to be measured on stay dates.
 *
 * Component paths are relative to `admin.importMap.baseDir` (`src/`) and must have matching
 * entries in `src/app/(payload)/admin/importMap.js`.
 */

/** Per-widget window picker, surfaced in the widget's settings drawer. */
const rangeField: Field = {
  name: 'range',
  type: 'select',
  label: 'Date range',
  defaultValue: '30d',
  options: RANGE_PRESETS,
  admin: {
    description: 'Reservation window. Occupancy uses this window as stay dates instead.',
  },
}

function widget(slug: string, label: string, file: string, minWidth: Widget['minWidth']): Widget {
  return {
    slug,
    label,
    Component: `/components/admin/widgets/${file}.tsx#default`,
    fields: [rangeField],
    minWidth,
  }
}

export const dashboard: DashboardConfig = {
  widgets: [
    // No range field: this one is a work queue measured against now, so a date window would only
    // let an admin hide requests they have not paid yet.
    {
      slug: 'staybd-payout-queue',
      label: 'Payouts to send',
      Component: '/components/admin/widgets/payout-queue.tsx#default',
      minWidth: 'medium',
    },
    widget('staybd-kpis', 'Marketplace KPIs', 'kpi-strip', 'medium'),
    widget('staybd-gbv', 'Gross booking value', 'gbv-trend', 'medium'),
    widget('staybd-funnel', 'Reservation funnel', 'reservation-funnel', 'small'),
    widget('staybd-cancellations', 'Cancellation dynamics', 'cancellation-breakdown', 'small'),
    widget('staybd-room-type-revenue', 'Revenue by room type', 'room-type-revenue', 'small'),
    widget('staybd-city-occupancy', 'Occupancy by city', 'city-occupancy', 'small'),
    widget('staybd-gateway-mix', 'Payment mix', 'gateway-mix', 'small'),
    widget('staybd-supply', 'Supply position', 'supply-snapshot', 'small'),
  ],
  // Payload only injects its own default layout when none is supplied (`??=`), so the built-in
  // `collections` widget has to be re-listed here or the collection cards disappear.
  defaultLayout: [
    { widgetSlug: 'staybd-kpis', width: 'full' },
    // Above every chart: it is the only widget with an action attached to it.
    { widgetSlug: 'staybd-payout-queue', width: 'full' },
    { widgetSlug: 'staybd-gbv', width: 'full' },
    { widgetSlug: 'staybd-funnel', width: 'medium' },
    { widgetSlug: 'staybd-cancellations', width: 'medium' },
    { widgetSlug: 'staybd-city-occupancy', width: 'medium' },
    { widgetSlug: 'staybd-room-type-revenue', width: 'medium' },
    { widgetSlug: 'staybd-gateway-mix', width: 'medium' },
    { widgetSlug: 'staybd-supply', width: 'medium' },
    { widgetSlug: 'collections', width: 'full' },
  ],
}

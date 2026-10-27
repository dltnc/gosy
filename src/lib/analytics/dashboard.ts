import 'server-only'

import { cache } from 'react'
import type { Payload } from 'payload'

import {
  fetchActiveRooms,
  fetchBookingsCreatedIn,
  fetchBookingsStayingIn,
  fetchPaymentsCreatedIn,
  fetchProperties,
  fetchRoomTypes,
  indexById,
  summarizeSupply,
} from './collect'
import {
  buildCancellationByPolicy,
  buildCancellationByTier,
  buildCityOccupancy,
  buildFunnel,
  buildGatewayMix,
  buildLeakage,
  buildRoomTypeRevenue,
  buildTimeBuckets,
  summarizeKpis,
} from './metrics'
import { isRangePreset, resolveRange } from './range'
import type {
  AnalyticsRange,
  CancellationGroup,
  CityOccupancy,
  FunnelStage,
  GatewaySlice,
  KpiSummary,
  RangePreset,
  RoomTypeRevenue,
  SupplySnapshot,
  TimeBucket,
} from './types'

export interface DashboardData {
  range: AnalyticsRange
  kpis: KpiSummary
  buckets: TimeBucket[]
  funnel: FunnelStage[]
  leakage: FunnelStage[]
  cancellationByTier: CancellationGroup[]
  cancellationByPolicy: CancellationGroup[]
  roomTypeRevenue: RoomTypeRevenue[]
  cityOccupancy: CityOccupancy[]
  gatewayMix: GatewaySlice[]
  supply: SupplySnapshot
  /** Platform default commission rate from platform-settings, for comparison against actuals. */
  configuredCommissionRate: number
  /** True when any underlying query hit its row cap. */
  truncated: boolean
}

/**
 * Load everything the dashboard needs in one pass.
 *
 * Wrapped in React's `cache` so the seven widgets rendering in a single request share one set of
 * queries per range rather than each re-reading the same rows.
 */
export const loadDashboardData = cache(
  async (payload: Payload, preset: RangePreset): Promise<DashboardData> => {
    const range = resolveRange(preset)

    const [created, staying, payments, properties, roomTypes, rooms] = await Promise.all([
      fetchBookingsCreatedIn(payload, range),
      fetchBookingsStayingIn(payload, range),
      fetchPaymentsCreatedIn(payload, range),
      fetchProperties(payload),
      fetchRoomTypes(payload),
      fetchActiveRooms(payload),
    ])

    const settings = await payload.findGlobal({
      slug: 'platform-settings',
      depth: 0,
      overrideAccess: true,
    })

    const propertiesById = indexById(properties)
    const roomTypesById = indexById(roomTypes)
    const supply = summarizeSupply(properties, roomTypes, rooms)

    return {
      range,
      kpis: summarizeKpis(created.bookings, supply.activeRooms * range.days),
      buckets: buildTimeBuckets(created.bookings, range),
      funnel: buildFunnel(created.bookings),
      leakage: buildLeakage(created.bookings),
      cancellationByTier: buildCancellationByTier(created.bookings, propertiesById),
      cancellationByPolicy: buildCancellationByPolicy(created.bookings, propertiesById),
      roomTypeRevenue: buildRoomTypeRevenue(created.bookings, roomTypesById),
      cityOccupancy: buildCityOccupancy(staying.bookings, properties, rooms, range),
      gatewayMix: buildGatewayMix(payments.payments),
      supply,
      configuredCommissionRate: settings.defaultCommissionRate ?? 0,
      truncated: created.truncated || staying.truncated || payments.truncated,
    }
  },
)

/** Read a widget's saved `range` setting, falling back to the 30-day default. */
export function resolvePresetFromWidgetData(
  widgetData: Record<string, unknown> | undefined,
): RangePreset {
  const value = widgetData?.range
  return isRangePreset(value) ? value : '30d'
}

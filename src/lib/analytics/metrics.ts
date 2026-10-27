import type {
  AnalyticsRange,
  BookingRecord,
  CancellationGroup,
  CityOccupancy,
  FunnelStage,
  GatewaySlice,
  KpiSummary,
  PaymentRecord,
  PropertyRecord,
  RoomRecord,
  RoomTypeRecord,
  RoomTypeRevenue,
  TimeBucket,
} from './types'
import { bucketKey, enumerateBuckets, nightsWithinRange } from './range'

/**
 * Pure aggregation over the slim records produced by `collect.ts`.
 *
 * Nothing in this file touches Payload, the database, or the network, so every function is
 * directly unit-testable. Two conventions run through it:
 *
 * - **Revenue is counted at reservation date** (`createdAt`), not stay date. A booking made
 *   today for a stay in December lands in today's bucket.
 * - **Occupancy is counted at stay date**, because a room-night can only be consumed on the
 *   night it happens. Those two functions take different booking sets by design.
 */

export const CANCELLED_STATUSES = ['cancelled_by_guest', 'cancelled_by_partner', 'no_show'] as const

type CancelledStatus = (typeof CANCELLED_STATUSES)[number]

export function isCancelled(booking: BookingRecord): boolean {
  return (CANCELLED_STATUSES as readonly string[]).includes(booking.status)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return round2((numerator / denominator) * 100)
}

/**
 * Tri-series time chart: gross booking value, cash net of discounts, and platform commission,
 * bucketed by the date each reservation was created.
 */
export function buildTimeBuckets(bookings: BookingRecord[], range: AnalyticsRange): TimeBucket[] {
  const buckets = new Map<string, TimeBucket>()

  for (const { key, label } of enumerateBuckets(range)) {
    buckets.set(key, {
      key,
      label,
      gbv: 0,
      cancelledGbv: 0,
      netCash: 0,
      commission: 0,
      bookings: 0,
      cancelled: 0,
    })
  }

  for (const booking of bookings) {
    const bucket = buckets.get(bucketKey(booking.createdAt, range.granularity))
    if (!bucket) continue

    bucket.gbv += booking.subtotal
    bucket.bookings += 1

    if (isCancelled(booking)) {
      bucket.cancelledGbv += booking.subtotal
      bucket.cancelled += 1
    } else {
      bucket.netCash += booking.totalAmount
      bucket.commission += booking.commissionAmount
    }
  }

  return [...buckets.values()].map((bucket) => ({
    ...bucket,
    gbv: round2(bucket.gbv),
    cancelledGbv: round2(bucket.cancelledGbv),
    netCash: round2(bucket.netCash),
    commission: round2(bucket.commission),
  }))
}

/**
 * Headline KPIs for reservations created in the window.
 *
 * `roomNightsAvailable` has to be supplied by the caller because it depends on live inventory
 * (active rooms x days in the window), which is not derivable from bookings alone.
 */
export function summarizeKpis(bookings: BookingRecord[], roomNightsAvailable: number): KpiSummary {
  let gbv = 0
  let netCash = 0
  let commission = 0
  let liveSubtotal = 0
  let roomNightsSold = 0
  let cancellations = 0
  let discountGiven = 0

  for (const booking of bookings) {
    gbv += booking.subtotal

    if (isCancelled(booking)) {
      cancellations += 1
      continue
    }

    liveSubtotal += booking.subtotal
    netCash += booking.totalAmount
    commission += booking.commissionAmount
    roomNightsSold += booking.roomNights
    discountGiven += booking.couponDiscountAmount + booking.pointsDiscountAmount
  }

  return {
    gbv: round2(gbv),
    netCash: round2(netCash),
    commission: round2(commission),
    takeRatePct: pct(commission, liveSubtotal),
    effectiveTakeRatePct: pct(commission, netCash),
    adr: roomNightsSold ? round2(liveSubtotal / roomNightsSold) : 0,
    revpar: roomNightsAvailable ? round2(liveSubtotal / roomNightsAvailable) : 0,
    roomNightsSold,
    roomNightsAvailable,
    occupancyPct: pct(roomNightsSold, roomNightsAvailable),
    bookings: bookings.length,
    cancellations,
    cancellationRatePct: pct(cancellations, bookings.length),
    discountGiven: round2(discountGiven),
  }
}

/**
 * How far reservations created in the window have progressed.
 *
 * Bookings carry only their *current* status — there is no status history — so progress is
 * inferred from the transition graph in `lib/bookings/statuses`. `checked_out` implies the
 * booking passed through `confirmed` and `checked_in`; `no_show` implies it was `confirmed`.
 * A cancellation, however, could have happened either side of payment, so it is counted as
 * having reached the created stage only. That makes "Payment cleared" a lower bound.
 */
const FUNNEL_RANK: Record<string, number> = {
  pending_payment: 0,
  cancelled_by_guest: 0,
  cancelled_by_partner: 0,
  confirmed: 1,
  no_show: 1,
  checked_in: 2,
  checked_out: 3,
}

const FUNNEL_STAGES: { key: string; label: string; rank: number }[] = [
  { key: 'created', label: 'Reservations created', rank: 0 },
  { key: 'confirmed', label: 'Payment cleared', rank: 1 },
  { key: 'checked_in', label: 'Guest checked in', rank: 2 },
  { key: 'checked_out', label: 'Stay completed', rank: 3 },
]

export function buildFunnel(bookings: BookingRecord[]): FunnelStage[] {
  const total = bookings.length

  return FUNNEL_STAGES.map((stage) => {
    const value = bookings.filter(
      (booking) => (FUNNEL_RANK[booking.status] ?? 0) >= stage.rank,
    ).length
    return { key: stage.key, label: stage.label, value, pct: pct(value, total) }
  })
}

const LEAKAGE_LABELS: Record<string, string> = {
  pending_payment: 'Awaiting payment',
  cancelled_by_guest: 'Cancelled by guest',
  cancelled_by_partner: 'Cancelled by partner',
  no_show: 'No-show',
}

/** Where reservations created in the window dropped out, as counts of current status. */
export function buildLeakage(bookings: BookingRecord[]): FunnelStage[] {
  const total = bookings.length
  return Object.entries(LEAKAGE_LABELS).map(([key, label]) => {
    const value = bookings.filter((booking) => booking.status === key).length
    return { key, label, value, pct: pct(value, total) }
  })
}

function groupCancellations(
  bookings: BookingRecord[],
  keyOf: (booking: BookingRecord) => { key: string; label: string } | null,
  order?: string[],
): CancellationGroup[] {
  const groups = new Map<string, CancellationGroup>()

  for (const booking of bookings) {
    const identity = keyOf(booking)
    if (!identity) continue

    let group = groups.get(identity.key)
    if (!group) {
      group = {
        key: identity.key,
        label: identity.label,
        total: 0,
        cancelledByGuest: 0,
        cancelledByPartner: 0,
        noShow: 0,
        cancellationRatePct: 0,
      }
      groups.set(identity.key, group)
    }

    group.total += 1
    if (booking.status === 'cancelled_by_guest') group.cancelledByGuest += 1
    if (booking.status === 'cancelled_by_partner') group.cancelledByPartner += 1
    if (booking.status === 'no_show') group.noShow += 1
  }

  const result = [...groups.values()].map((group) => ({
    ...group,
    cancellationRatePct: pct(
      group.cancelledByGuest + group.cancelledByPartner + group.noShow,
      group.total,
    ),
  }))

  if (order) {
    return result.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  }
  return result.sort((a, b) => b.total - a.total)
}

const TIER_LABELS: Record<string, string> = {
  budget: 'Budget',
  standard: 'Standard',
  premium: 'Premium',
  flagship: 'Flagship',
}

const TIER_ORDER = ['budget', 'standard', 'premium', 'flagship']

/**
 * Cancellation rate by property tier.
 *
 * Tier is used rather than property type because only two property types exist (hotel, resort),
 * which makes for a chart with nothing to say.
 */
export function buildCancellationByTier(
  bookings: BookingRecord[],
  propertiesById: Map<number, PropertyRecord>,
): CancellationGroup[] {
  return groupCancellations(
    bookings,
    (booking) => {
      const property = booking.propertyId ? propertiesById.get(booking.propertyId) : undefined
      if (!property) return null
      return { key: property.tier, label: TIER_LABELS[property.tier] ?? property.tier }
    },
    TIER_ORDER,
  )
}

/**
 * Cancellation rate split by whether the property advertises free cancellation.
 *
 * The `free_cancellation` trust badge is the only queryable signal — `policies.cancellationPolicy`
 * is an unstructured textarea, so it cannot be grouped on.
 */
export function buildCancellationByPolicy(
  bookings: BookingRecord[],
  propertiesById: Map<number, PropertyRecord>,
): CancellationGroup[] {
  return groupCancellations(
    bookings,
    (booking) => {
      const property = booking.propertyId ? propertiesById.get(booking.propertyId) : undefined
      if (!property) return null
      return property.freeCancellation
        ? { key: 'free', label: 'Free cancellation' }
        : { key: 'standard', label: 'Standard policy' }
    },
    ['free', 'standard'],
  )
}

/**
 * Gross revenue by room type for live reservations created in the window. Long tails are folded
 * into a single "Other" bar so the chart stays readable.
 *
 * A booking can mix room types, so revenue and room-nights are attributed per line. The booking
 * itself is counted once per type it contains, however many rooms of that type it took — otherwise
 * a three-room stay would read as three bookings.
 */
export function buildRoomTypeRevenue(
  bookings: BookingRecord[],
  roomTypesById: Map<number, RoomTypeRecord>,
  limit = 8,
): RoomTypeRevenue[] {
  const groups = new Map<string, RoomTypeRevenue>()

  for (const booking of bookings) {
    if (isCancelled(booking)) continue
    const counted = new Set<string>()

    for (const room of booking.rooms) {
      const roomType = room.roomTypeId ? roomTypesById.get(room.roomTypeId) : undefined
      const key = roomType ? String(roomType.id) : 'unknown'
      const label = roomType?.name ?? 'Unattributed'

      let group = groups.get(key)
      if (!group) {
        group = { key, label, revenue: 0, bookings: 0, roomNights: 0, adr: 0 }
        groups.set(key, group)
      }
      group.revenue += room.subtotal
      group.roomNights += room.nights
      if (!counted.has(key)) {
        group.bookings += 1
        counted.add(key)
      }
    }
  }

  const ranked = [...groups.values()].sort((a, b) => b.revenue - a.revenue)
  const head = ranked.slice(0, limit)
  const tail = ranked.slice(limit)

  if (tail.length) {
    head.push(
      tail.reduce(
        (acc, group) => ({
          key: 'other',
          label: `Other (${tail.length})`,
          revenue: acc.revenue + group.revenue,
          bookings: acc.bookings + group.bookings,
          roomNights: acc.roomNights + group.roomNights,
          adr: 0,
        }),
        { key: 'other', label: '', revenue: 0, bookings: 0, roomNights: 0, adr: 0 },
      ),
    )
  }

  return head.map((group) => ({
    ...group,
    revenue: round2(group.revenue),
    adr: group.roomNights ? round2(group.revenue / group.roomNights) : 0,
  }))
}

/**
 * Booked versus available room-nights per city.
 *
 * Unlike every other metric here this one is **stay-date based**: pass bookings whose stay
 * overlaps the window, not bookings created in it. Availability is active rooms in the city
 * multiplied by the days in the window, which is the standard RevPAR denominator — it assumes
 * a room is sellable every night and so slightly overstates supply for seasonal closures.
 */
export function buildCityOccupancy(
  stayBookings: BookingRecord[],
  properties: PropertyRecord[],
  rooms: RoomRecord[],
  range: AnalyticsRange,
  limit = 8,
): CityOccupancy[] {
  const cityByProperty = new Map<number, string>()
  const groups = new Map<string, CityOccupancy>()

  for (const property of properties) {
    if (property.status !== 'approved') continue
    const city = property.city?.trim() || 'Unspecified'
    cityByProperty.set(property.id, city)

    let group = groups.get(city)
    if (!group) {
      group = {
        key: city,
        label: city,
        roomNightsBooked: 0,
        roomNightsAvailable: 0,
        occupancyPct: 0,
        properties: 0,
        rooms: 0,
      }
      groups.set(city, group)
    }
    group.properties += 1
  }

  for (const room of rooms) {
    const city = room.propertyId ? cityByProperty.get(room.propertyId) : undefined
    const group = city ? groups.get(city) : undefined
    if (!group) continue
    group.rooms += 1
    group.roomNightsAvailable += range.days
  }

  for (const booking of stayBookings) {
    if (isCancelled(booking)) continue
    const city = booking.propertyId ? cityByProperty.get(booking.propertyId) : undefined
    const group = city ? groups.get(city) : undefined
    if (!group) continue
    // Each room on the booking consumes the same nights, so a three-room stay fills three rooms.
    group.roomNightsBooked +=
      nightsWithinRange(booking.checkInDate, booking.checkOutDate, range) * booking.roomCount
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      occupancyPct: pct(group.roomNightsBooked, group.roomNightsAvailable),
    }))
    .sort((a, b) => b.roomNightsAvailable - a.roomNightsAvailable)
    .slice(0, limit)
}

const GATEWAY_LABELS: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  sslcommerz: 'SSLCOMMERZ',
  aamarpay: 'aamarPay',
  bank_transfer: 'Bank transfer',
  manual: 'Manual',
}

/**
 * Payment attempts by gateway. `amount` sums successful payments only, so the slices add up to
 * money actually collected, while `attempts` and `successRatePct` expose gateway reliability.
 */
export function buildGatewayMix(payments: PaymentRecord[]): GatewaySlice[] {
  const groups = new Map<string, GatewaySlice>()

  for (const payment of payments) {
    if (payment.purpose !== 'booking_payment') continue

    let group = groups.get(payment.gateway)
    if (!group) {
      group = {
        key: payment.gateway,
        label: GATEWAY_LABELS[payment.gateway] ?? payment.gateway,
        attempts: 0,
        successes: 0,
        amount: 0,
        successRatePct: 0,
      }
      groups.set(payment.gateway, group)
    }

    group.attempts += 1
    if (payment.status === 'success') {
      group.successes += 1
      group.amount += payment.amount
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      amount: round2(group.amount),
      successRatePct: pct(group.successes, group.attempts),
    }))
    .sort((a, b) => b.amount - a.amount || b.attempts - a.attempts)
}

export type { CancelledStatus }

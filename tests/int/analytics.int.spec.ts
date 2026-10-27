import { describe, expect, it } from 'vitest'

import {
  MS_PER_DAY,
  addDays,
  bucketKey,
  enumerateBuckets,
  isRangePreset,
  marketDayKey,
  nightsWithinRange,
  resolveRange,
  startOfMarketDay,
  startOfMarketWeek,
} from '@/lib/analytics/range'
import {
  buildCancellationByPolicy,
  buildCancellationByTier,
  buildCityOccupancy,
  buildFunnel,
  buildGatewayMix,
  buildLeakage,
  buildRoomTypeRevenue,
  buildTimeBuckets,
  isCancelled,
  summarizeKpis,
} from '@/lib/analytics/metrics'
import type {
  BookingRecord,
  BookingRoomRecord,
  PaymentRecord,
  PropertyRecord,
  RoomRecord,
  RoomTypeRecord,
} from '@/lib/analytics/types'

/**
 * Unit tests for the dependency-free half of the analytics layer. Nothing here touches Payload or
 * the database, so this spec runs without a reachable Postgres instance.
 *
 * The invariant under test throughout: revenue is bucketed at **reservation date**
 * (`createdAt`), while occupancy is bucketed at **stay date**.
 */

// 2026-08-28T09:00:00+06:00 — mid-afternoon in Dhaka, still the previous UTC day.
const NOW = new Date('2026-08-28T03:00:00.000Z')

/**
 * Bookings are described the way a guest picks them — "two rooms of type 1" — and expanded here into
 * the one-row-per-room shape the metrics read. `rooms` can be passed directly for a mixed-type stay.
 */
type BookingOverrides = Partial<Omit<BookingRecord, 'rooms' | 'roomCount' | 'roomNights'>> &
  Pick<BookingRecord, 'id'> & {
    roomTypeId?: number | null
    roomCount?: number
    rooms?: BookingRoomRecord[]
  }

function booking({
  roomTypeId = 1,
  roomCount,
  rooms: explicitRooms,
  ...overrides
}: BookingOverrides): BookingRecord {
  const nights = overrides.nights ?? 2
  const subtotal = overrides.subtotal ?? 10000
  const count = roomCount ?? explicitRooms?.length ?? 1
  const rooms =
    explicitRooms ??
    Array.from({ length: count }, () => ({ roomTypeId, nights, subtotal: subtotal / count }))

  return {
    status: 'confirmed',
    createdAt: '2026-08-28T03:00:00.000Z',
    checkInDate: '2026-09-01T00:00:00.000Z',
    checkOutDate: '2026-09-03T00:00:00.000Z',
    propertyId: 1,
    nights,
    subtotal,
    totalAmount: 10000,
    commissionAmount: 1000,
    couponDiscountAmount: 0,
    pointsDiscountAmount: 0,
    ...overrides,
    rooms,
    roomCount: rooms.length,
    roomNights: rooms.reduce((sum, room) => sum + room.nights, 0),
  }
}

function property(overrides: Partial<PropertyRecord> & Pick<PropertyRecord, 'id'>): PropertyRecord {
  return {
    name: `Property ${overrides.id}`,
    city: 'Dhaka',
    tier: 'standard',
    propertyType: 'hotel',
    status: 'approved',
    freeCancellation: false,
    ...overrides,
  }
}

function payment(overrides: Partial<PaymentRecord> & Pick<PaymentRecord, 'id'>): PaymentRecord {
  return {
    gateway: 'bkash',
    status: 'success',
    purpose: 'booking_payment',
    amount: 5000,
    createdAt: '2026-08-28T03:00:00.000Z',
    ...overrides,
  }
}

describe('market-local date maths', () => {
  it('treats a late-UTC timestamp as the next Dhaka day', () => {
    // 2026-08-27T20:00Z is 2026-08-28T02:00 in Dhaka.
    expect(marketDayKey('2026-08-27T20:00:00.000Z')).toBe('2026-08-28')
    // A naive UTC implementation would answer 2026-08-27 here.
    expect(marketDayKey('2026-08-27T17:59:59.000Z')).toBe('2026-08-27')
  })

  it('starts the market day at 18:00 UTC the day before', () => {
    expect(startOfMarketDay(NOW).toISOString()).toBe('2026-08-27T18:00:00.000Z')
  })

  it('anchors weeks on Sunday', () => {
    // 2026-08-28 (Dhaka) is a Friday, so the week opened on Sunday 2026-08-23.
    expect(marketDayKey(startOfMarketWeek(NOW))).toBe('2026-08-23')
  })

  it('validates range presets', () => {
    expect(isRangePreset('30d')).toBe(true)
    expect(isRangePreset('all-time')).toBe(false)
    expect(isRangePreset(undefined)).toBe(false)
  })
})

describe('resolveRange', () => {
  it('includes the whole of today and covers exactly N days', () => {
    const range = resolveRange('7d', NOW)
    expect(range.to.toISOString()).toBe('2026-08-28T18:00:00.000Z')
    expect(range.from.toISOString()).toBe('2026-08-21T18:00:00.000Z')
    expect(range.days).toBe(7)
    expect(range.granularity).toBe('day')
    expect(range.to.getTime() > NOW.getTime()).toBe(true)
  })

  it('rolls 12m back to the first of the month, 11 months ago', () => {
    const range = resolveRange('12m', NOW)
    expect(marketDayKey(range.from)).toBe('2025-09-01')
    expect(range.granularity).toBe('month')
  })

  it('starts ytd on 1 January in market time', () => {
    const range = resolveRange('ytd', NOW)
    expect(marketDayKey(range.from)).toBe('2026-01-01')
    expect(range.granularity).toBe('month')
  })

  it('switches 90d to weekly buckets', () => {
    expect(resolveRange('90d', NOW).granularity).toBe('week')
  })
})

describe('enumerateBuckets', () => {
  it('emits one bucket per day for 7d, oldest first', () => {
    const buckets = enumerateBuckets(resolveRange('7d', NOW))
    expect(buckets).toHaveLength(7)
    expect(buckets[0].key).toBe('2026-08-22')
    expect(buckets[6].key).toBe('2026-08-28')
  })

  it('emits 12 month buckets for 12m', () => {
    const buckets = enumerateBuckets(resolveRange('12m', NOW))
    expect(buckets).toHaveLength(12)
    expect(buckets[0].key).toBe('2025-09-01')
    expect(buckets[0].label).toBe('Sep 2025')
    expect(buckets[11].key).toBe('2026-08-01')
  })

  it('aligns weekly buckets to the Sunday on or before the window start', () => {
    const buckets = enumerateBuckets(resolveRange('90d', NOW))
    expect(buckets[0].key).toBe(marketDayKey(startOfMarketWeek(resolveRange('90d', NOW).from)))
    expect(new Date(buckets[0].key).getUTCDay()).toBe(0)
  })
})

describe('buildTimeBuckets', () => {
  const range = resolveRange('7d', NOW)

  it('buckets revenue on reservation date, not stay date', () => {
    const buckets = buildTimeBuckets(
      [
        // Booked today, staying in December — must land in today's bucket.
        booking({
          id: 1,
          createdAt: '2026-08-27T20:00:00.000Z',
          checkInDate: '2026-12-20',
          checkOutDate: '2026-12-22',
        }),
        booking({ id: 2, createdAt: '2026-08-25T06:00:00.000Z', subtotal: 4000 }),
      ],
      range,
    )

    const today = buckets.find((bucket) => bucket.key === '2026-08-28')
    expect(today?.gbv).toBe(10000)
    expect(today?.bookings).toBe(1)
    expect(buckets.find((bucket) => bucket.key === '2026-08-25')?.gbv).toBe(4000)
  })

  it('keeps cancelled GBV out of net cash and commission', () => {
    const [bucket] = buildTimeBuckets(
      [
        booking({ id: 1, createdAt: '2026-08-28T04:00:00.000Z' }),
        booking({
          id: 2,
          createdAt: '2026-08-28T04:00:00.000Z',
          status: 'cancelled_by_guest',
          subtotal: 7000,
          totalAmount: 7000,
          commissionAmount: 700,
        }),
      ],
      resolveRange('7d', NOW),
    ).filter((entry) => entry.key === '2026-08-28')

    expect(bucket.gbv).toBe(17000)
    expect(bucket.cancelledGbv).toBe(7000)
    expect(bucket.netCash).toBe(10000)
    expect(bucket.commission).toBe(1000)
    expect(bucket.cancelled).toBe(1)
  })

  it('returns a zeroed bucket for every empty day', () => {
    const buckets = buildTimeBuckets([], range)
    expect(buckets).toHaveLength(7)
    expect(buckets.every((bucket) => bucket.gbv === 0 && bucket.bookings === 0)).toBe(true)
  })

  it('drops bookings that fall outside the window', () => {
    const buckets = buildTimeBuckets(
      [booking({ id: 1, createdAt: '2026-01-01T06:00:00.000Z' })],
      range,
    )
    expect(buckets.reduce((sum, bucket) => sum + bucket.gbv, 0)).toBe(0)
  })

  it('agrees with bucketKey on bucket identity', () => {
    expect(bucketKey('2026-08-27T20:00:00.000Z', 'day')).toBe('2026-08-28')
    expect(bucketKey('2026-08-27T20:00:00.000Z', 'month')).toBe('2026-08-01')
  })
})

describe('nightsWithinRange', () => {
  const range = resolveRange('7d', NOW)

  it('clips a stay that straddles the window start', () => {
    // Window opens 2026-08-22 (market). Stay runs 20th → 24th, so 2 nights land inside.
    expect(nightsWithinRange('2026-08-20', '2026-08-24', range)).toBe(2)
  })

  it('counts a fully contained stay', () => {
    expect(nightsWithinRange('2026-08-24', '2026-08-27', range)).toBe(3)
  })

  it('returns zero for a stay entirely in the future', () => {
    expect(nightsWithinRange('2026-09-10', '2026-09-12', range)).toBe(0)
  })

  it('returns zero for a same-day check-in and check-out', () => {
    expect(nightsWithinRange('2026-08-24', '2026-08-24', range)).toBe(0)
  })
})

describe('summarizeKpis', () => {
  it('separates take rate on gross from take rate on cash collected', () => {
    // Commission is charged on the gross subtotal, but the guest pays net of discounts, so the
    // effective rate the platform earns on cash collected is higher than the nominal rate.
    const kpis = summarizeKpis(
      [
        booking({
          id: 1,
          subtotal: 10000,
          couponDiscountAmount: 1000,
          pointsDiscountAmount: 500,
          totalAmount: 8500,
          commissionAmount: 1000,
        }),
      ],
      100,
    )

    expect(kpis.gbv).toBe(10000)
    expect(kpis.netCash).toBe(8500)
    expect(kpis.takeRatePct).toBe(10)
    expect(kpis.effectiveTakeRatePct).toBe(11.76)
    expect(kpis.discountGiven).toBe(1500)
  })

  it('computes ADR from room-nights sold and RevPAR from room-nights available', () => {
    const kpis = summarizeKpis(
      [
        booking({ id: 1, nights: 2, subtotal: 10000 }),
        booking({ id: 2, nights: 3, subtotal: 15000 }),
      ],
      50,
    )

    expect(kpis.roomNightsSold).toBe(5)
    expect(kpis.adr).toBe(5000)
    expect(kpis.revpar).toBe(500)
    expect(kpis.occupancyPct).toBe(10)
  })

  it('counts every room on a booking towards room-nights sold', () => {
    // Three rooms for two nights is six room-nights, not two: ADR must divide by rooms sold, or a
    // multi-room stay would read as an implausibly expensive single room.
    const kpis = summarizeKpis([booking({ id: 1, roomCount: 3, nights: 2, subtotal: 30000 })], 12)

    expect(kpis.roomNightsSold).toBe(6)
    expect(kpis.adr).toBe(5000)
    expect(kpis.occupancyPct).toBe(50)
  })

  it('excludes cancelled reservations from rate metrics but keeps them in GBV', () => {
    const kpis = summarizeKpis(
      [
        booking({ id: 1 }),
        booking({ id: 2, status: 'cancelled_by_guest', subtotal: 5000, commissionAmount: 500 }),
        booking({ id: 3, status: 'no_show', subtotal: 5000, commissionAmount: 500 }),
      ],
      0,
    )

    expect(kpis.gbv).toBe(20000)
    expect(kpis.commission).toBe(1000)
    expect(kpis.roomNightsSold).toBe(2)
    expect(kpis.cancellations).toBe(2)
    expect(kpis.cancellationRatePct).toBe(66.67)
  })

  it('never divides by zero on an empty window', () => {
    const kpis = summarizeKpis([], 0)
    expect(kpis).toMatchObject({
      gbv: 0,
      takeRatePct: 0,
      effectiveTakeRatePct: 0,
      adr: 0,
      revpar: 0,
      occupancyPct: 0,
      cancellationRatePct: 0,
    })
  })

  it('classifies exactly the three terminal-failure statuses as cancelled', () => {
    expect(isCancelled(booking({ id: 1, status: 'cancelled_by_guest' }))).toBe(true)
    expect(isCancelled(booking({ id: 2, status: 'cancelled_by_partner' }))).toBe(true)
    expect(isCancelled(booking({ id: 3, status: 'no_show' }))).toBe(true)
    expect(isCancelled(booking({ id: 4, status: 'checked_out' }))).toBe(false)
    expect(isCancelled(booking({ id: 5, status: 'pending_payment' }))).toBe(false)
  })
})

describe('buildFunnel', () => {
  it('infers progression from current status via the transition graph', () => {
    const stages = buildFunnel([
      booking({ id: 1, status: 'pending_payment' }),
      booking({ id: 2, status: 'confirmed' }),
      booking({ id: 3, status: 'checked_in' }),
      booking({ id: 4, status: 'checked_out' }),
    ])

    expect(stages.map((stage) => stage.value)).toEqual([4, 3, 2, 1])
    expect(stages[0].pct).toBe(100)
    expect(stages[3].pct).toBe(25)
  })

  it('counts a no-show as having cleared payment but not checked in', () => {
    const stages = buildFunnel([booking({ id: 1, status: 'no_show' })])
    expect(stages.map((stage) => stage.value)).toEqual([1, 1, 0, 0])
  })

  it('counts cancellations at the created stage only, making payment cleared a lower bound', () => {
    const stages = buildFunnel([
      booking({ id: 1, status: 'cancelled_by_guest' }),
      booking({ id: 2, status: 'cancelled_by_partner' }),
    ])
    expect(stages.map((stage) => stage.value)).toEqual([2, 0, 0, 0])
  })

  it('is monotonically non-increasing across stages', () => {
    const stages = buildFunnel([
      booking({ id: 1, status: 'pending_payment' }),
      booking({ id: 2, status: 'checked_out' }),
      booking({ id: 3, status: 'no_show' }),
      booking({ id: 4, status: 'confirmed' }),
    ])
    for (let i = 1; i < stages.length; i += 1) {
      expect(stages[i].value).toBeLessThanOrEqual(stages[i - 1].value)
    }
  })

  it('reports leakage as counts of current status', () => {
    const leakage = buildLeakage([
      booking({ id: 1, status: 'pending_payment' }),
      booking({ id: 2, status: 'cancelled_by_guest' }),
      booking({ id: 3, status: 'no_show' }),
      booking({ id: 4, status: 'checked_out' }),
    ])

    expect(Object.fromEntries(leakage.map((row) => [row.key, row.value]))).toEqual({
      pending_payment: 1,
      cancelled_by_guest: 1,
      cancelled_by_partner: 0,
      no_show: 1,
    })
    expect(leakage.find((row) => row.key === 'no_show')?.pct).toBe(25)
  })
})

describe('cancellation grouping', () => {
  const propertiesById = new Map<number, PropertyRecord>([
    [1, property({ id: 1, tier: 'budget', freeCancellation: true })],
    [2, property({ id: 2, tier: 'flagship', freeCancellation: false })],
  ])

  const bookings = [
    booking({ id: 1, propertyId: 1, status: 'cancelled_by_guest' }),
    booking({ id: 2, propertyId: 1, status: 'checked_out' }),
    booking({ id: 3, propertyId: 2, status: 'no_show' }),
    booking({ id: 4, propertyId: 2, status: 'cancelled_by_partner' }),
    booking({ id: 5, propertyId: 2, status: 'confirmed' }),
  ]

  it('groups by tier in tier order, not by frequency', () => {
    const groups = buildCancellationByTier(bookings, propertiesById)
    expect(groups.map((group) => group.key)).toEqual(['budget', 'flagship'])

    const flagship = groups[1]
    expect(flagship.total).toBe(3)
    expect(flagship.noShow).toBe(1)
    expect(flagship.cancelledByPartner).toBe(1)
    expect(flagship.cancellationRatePct).toBe(66.67)
  })

  it('splits by the free_cancellation trust badge', () => {
    const groups = buildCancellationByPolicy(bookings, propertiesById)
    expect(groups.map((group) => group.key)).toEqual(['free', 'standard'])
    expect(groups[0].label).toBe('Free cancellation')
    expect(groups[0].cancellationRatePct).toBe(50)
    expect(groups[1].cancellationRatePct).toBe(66.67)
  })

  it('skips bookings whose property cannot be resolved', () => {
    const groups = buildCancellationByTier(
      [booking({ id: 9, propertyId: 404 }), booking({ id: 10, propertyId: null })],
      propertiesById,
    )
    expect(groups).toEqual([])
  })
})

describe('buildRoomTypeRevenue', () => {
  const roomTypesById = new Map<number, RoomTypeRecord>(
    [1, 2, 3].map((id) => [id, { id, name: `Type ${id}`, propertyId: 1 }]),
  )

  it('ranks by gross revenue and derives ADR from room-nights', () => {
    const rows = buildRoomTypeRevenue(
      [
        booking({ id: 1, roomTypeId: 1, subtotal: 6000, nights: 2 }),
        booking({ id: 2, roomTypeId: 2, subtotal: 9000, nights: 3 }),
      ],
      roomTypesById,
    )

    expect(rows.map((row) => row.label)).toEqual(['Type 2', 'Type 1'])
    expect(rows[0].adr).toBe(3000)
    expect(rows[1].adr).toBe(3000)
  })

  it('excludes cancelled reservations', () => {
    const rows = buildRoomTypeRevenue(
      [
        booking({ id: 1, roomTypeId: 1, subtotal: 6000 }),
        booking({ id: 2, roomTypeId: 1, subtotal: 6000, status: 'cancelled_by_guest' }),
      ],
      roomTypesById,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].revenue).toBe(6000)
    expect(rows[0].bookings).toBe(1)
  })

  it('folds the tail into a single Other row', () => {
    const rows = buildRoomTypeRevenue(
      [
        booking({ id: 1, roomTypeId: 1, subtotal: 9000, nights: 1 }),
        booking({ id: 2, roomTypeId: 2, subtotal: 5000, nights: 1 }),
        booking({ id: 3, roomTypeId: 3, subtotal: 1000, nights: 1 }),
      ],
      roomTypesById,
      1,
    )

    expect(rows).toHaveLength(2)
    expect(rows[1].key).toBe('other')
    expect(rows[1].label).toBe('Other (2)')
    expect(rows[1].revenue).toBe(6000)
    expect(rows[1].bookings).toBe(2)
    expect(rows[1].adr).toBe(3000)
  })

  it('splits a mixed-type booking across the types it contains', () => {
    // One reservation, two room types: revenue follows the line, and each type counts the booking
    // once — twice over would double the booking count from a single stay.
    const rows = buildRoomTypeRevenue(
      [
        booking({
          id: 1,
          subtotal: 21000,
          rooms: [
            { roomTypeId: 1, nights: 3, subtotal: 6000 },
            { roomTypeId: 1, nights: 3, subtotal: 6000 },
            { roomTypeId: 2, nights: 3, subtotal: 9000 },
          ],
        }),
      ],
      roomTypesById,
    )

    expect(rows.map((row) => row.label)).toEqual(['Type 1', 'Type 2'])
    expect(rows[0]).toMatchObject({ revenue: 12000, bookings: 1, roomNights: 6, adr: 2000 })
    expect(rows[1]).toMatchObject({ revenue: 9000, bookings: 1, roomNights: 3, adr: 3000 })
  })

  it('labels an unresolvable room type as Unattributed', () => {
    const rows = buildRoomTypeRevenue([booking({ id: 1, roomTypeId: null })], roomTypesById)
    expect(rows[0].key).toBe('unknown')
    expect(rows[0].label).toBe('Unattributed')
  })
})

describe('buildCityOccupancy', () => {
  const range = resolveRange('7d', NOW)
  const properties = [
    property({ id: 1, city: 'Dhaka' }),
    property({ id: 2, city: 'Cox’s Bazar' }),
    // Not approved, so neither it nor its rooms count as supply.
    property({ id: 3, city: 'Sylhet', status: 'pending' }),
  ]
  const rooms: RoomRecord[] = [
    { id: 1, propertyId: 1 },
    { id: 2, propertyId: 1 },
    { id: 3, propertyId: 2 },
    { id: 4, propertyId: 3 },
  ]

  it('multiplies active rooms by days in the window for availability', () => {
    const cities = buildCityOccupancy([], properties, rooms, range)

    expect(range.days).toBe(7)
    expect(range.to.getTime() - range.from.getTime()).toBe(7 * MS_PER_DAY)
    expect(cities.map((city) => city.key)).toEqual(['Dhaka', 'Cox’s Bazar'])
    expect(cities[0]).toMatchObject({ properties: 1, rooms: 2, roomNightsAvailable: 14 })
    expect(cities[1]).toMatchObject({ properties: 1, rooms: 1, roomNightsAvailable: 7 })
  })

  it('counts room-nights on stay dates, clipped to the window', () => {
    const cities = buildCityOccupancy(
      [
        // Stay straddles the window start: only the nights inside count.
        booking({
          id: 1,
          propertyId: 1,
          checkInDate: marketDayKey(addDays(range.from, -2)),
          checkOutDate: marketDayKey(addDays(range.from, 3)),
        }),
        booking({ id: 2, propertyId: 1, checkInDate: '2026-08-24', checkOutDate: '2026-08-26' }),
      ],
      properties,
      rooms,
      range,
    )

    const dhaka = cities.find((city) => city.key === 'Dhaka')
    expect(dhaka?.roomNightsBooked).toBe(5)
    expect(dhaka?.occupancyPct).toBe(35.71)
  })

  it('fills one room-night per room booked', () => {
    // Two rooms for two nights occupies four of Dhaka's fourteen available room-nights.
    const cities = buildCityOccupancy(
      [
        booking({
          id: 1,
          propertyId: 1,
          roomCount: 2,
          checkInDate: '2026-08-24',
          checkOutDate: '2026-08-26',
        }),
      ],
      properties,
      rooms,
      range,
    )

    const dhaka = cities.find((city) => city.key === 'Dhaka')
    expect(dhaka?.roomNightsBooked).toBe(4)
    expect(dhaka?.occupancyPct).toBe(28.57)
  })

  it('ignores cancelled stays and unapproved supply', () => {
    const cities = buildCityOccupancy(
      [
        booking({
          id: 1,
          propertyId: 1,
          status: 'cancelled_by_guest',
          checkInDate: '2026-08-24',
          checkOutDate: '2026-08-26',
        }),
        booking({ id: 2, propertyId: 3, checkInDate: '2026-08-24', checkOutDate: '2026-08-26' }),
      ],
      properties,
      rooms,
      range,
    )

    expect(cities.every((city) => city.roomNightsBooked === 0)).toBe(true)
    expect(cities.some((city) => city.key === 'Sylhet')).toBe(false)
  })
})

describe('buildGatewayMix', () => {
  it('sums money only from successful attempts while keeping every attempt in the rate', () => {
    const slices = buildGatewayMix([
      payment({ id: 1, gateway: 'bkash', status: 'success', amount: 5000 }),
      payment({ id: 2, gateway: 'bkash', status: 'failed', amount: 5000 }),
      payment({ id: 3, gateway: 'nagad', status: 'success', amount: 12000 }),
      payment({ id: 4, gateway: 'nagad', status: 'success', amount: 3000 }),
    ])

    expect(slices.map((slice) => slice.key)).toEqual(['nagad', 'bkash'])
    expect(slices[0]).toMatchObject({ amount: 15000, attempts: 2, successRatePct: 100 })
    expect(slices[1]).toMatchObject({ amount: 5000, attempts: 2, successRatePct: 50 })
    expect(slices[1].label).toBe('bKash')
  })

  it('ignores refunds and subscription payments', () => {
    const slices = buildGatewayMix([
      payment({ id: 1, purpose: 'refund', amount: 9000 }),
      payment({ id: 2, purpose: 'subscription_payment', amount: 9000 }),
      payment({ id: 3, purpose: 'booking_payment', amount: 1000 }),
    ])

    expect(slices).toHaveLength(1)
    expect(slices[0].amount).toBe(1000)
    expect(slices[0].attempts).toBe(1)
  })

  it('returns an empty list when nothing was attempted', () => {
    expect(buildGatewayMix([])).toEqual([])
  })
})

import type { Payload, Where } from 'payload'

import type { Booking } from '@/payload-types'
import type {
  AnalyticsRange,
  BookingRecord,
  BookingRoomRecord,
  PaymentRecord,
  PropertyRecord,
  RoomRecord,
  RoomTypeRecord,
  SupplySnapshot,
} from './types'
import type { BookingStatus } from '@/lib/bookings/statuses'

/**
 * Reads for the admin dashboard, done through the Payload local API.
 *
 * Payload has no aggregation primitives, so rows are paged in and folded in JS by `metrics.ts`.
 * That is fine for an admin-sized window and keeps everything type-checked against
 * `payload-types.ts`, but it does not scale forever — hence `MAX_ROWS`, which caps the work and
 * reports back honestly instead of silently truncating. When volume outgrows this, the internals
 * of this module can be swapped for raw SQL without touching the metrics or the widgets.
 */

const PAGE_SIZE = 500
const MAX_ROWS = 20_000

export interface Truncatable {
  /** True when the query hit `MAX_ROWS` and the numbers downstream are a partial view. */
  truncated: boolean
}

async function paginate<TDoc>(
  find: (page: number) => Promise<{ docs: TDoc[]; hasNextPage?: boolean | null }>,
): Promise<{ docs: TDoc[] } & Truncatable> {
  const docs: TDoc[] = []
  let page = 1
  let truncated = false

  for (;;) {
    const result = await find(page)
    docs.push(...result.docs)

    if (!result.hasNextPage) break
    if (docs.length >= MAX_ROWS) {
      truncated = true
      break
    }
    page += 1
  }

  return { docs, truncated }
}

/** Relationship fields come back as ids at depth 0, but the generated types stay permissive. */
function relId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function toBookingRecord(doc: Booking): BookingRecord {
  const pricing = doc.pricing ?? {}
  const stayNights = num(pricing.nights)
  const subtotal = num(pricing.subtotal)

  // A booking holds one row per physical room. Bookings written before rooms became line items have
  // none, so the `roomType` mirror stands in as a single room for the whole subtotal — otherwise they
  // would drop out of room-type revenue and undercount occupancy.
  const items = Array.isArray(doc.items) ? doc.items : []
  let rooms: BookingRoomRecord[] =
    items.length > 0
      ? items.map((item) => ({
          roomTypeId: relId(item.roomType),
          nights: num(item.nights) || stayNights,
          subtotal: num(item.lineSubtotal),
        }))
      : [{ roomTypeId: relId(doc.roomType), nights: stayNights, subtotal }]

  // Rows are supposed to carry their own frozen charge, but a row saved without one would attribute
  // zero revenue to its room type while the booking still shows a subtotal. Spread it evenly instead.
  if (subtotal > 0 && rooms.every((room) => room.subtotal === 0)) {
    const share = subtotal / rooms.length
    rooms = rooms.map((room) => ({ ...room, subtotal: share }))
  }

  return {
    id: doc.id,
    status: (doc.status ?? 'pending_payment') as BookingStatus,
    createdAt: doc.createdAt,
    checkInDate: doc.checkInDate,
    checkOutDate: doc.checkOutDate,
    propertyId: relId(doc.property),
    rooms,
    roomCount: rooms.length,
    roomNights: rooms.reduce((sum, room) => sum + room.nights, 0),
    nights: stayNights,
    subtotal,
    totalAmount: num(pricing.totalAmount),
    commissionAmount: num(pricing.commissionAmount),
    couponDiscountAmount: num(pricing.couponDiscountAmount),
    pointsDiscountAmount: num(pricing.pointsDiscountAmount),
  }
}

function bookingsPage(payload: Payload, where: Where) {
  return (page: number) =>
    payload.find({
      collection: 'bookings',
      where,
      depth: 0,
      limit: PAGE_SIZE,
      page,
      sort: 'id',
      overrideAccess: true,
    })
}

/** Reservations *created* inside the window — the basis for GBV, commission and the funnel. */
export async function fetchBookingsCreatedIn(
  payload: Payload,
  range: AnalyticsRange,
): Promise<{ bookings: BookingRecord[] } & Truncatable> {
  const { docs, truncated } = await paginate(
    bookingsPage(payload, {
      createdAt: {
        greater_than_equal: range.from.toISOString(),
        less_than: range.to.toISOString(),
      },
    }),
  )
  return { bookings: docs.map(toBookingRecord), truncated }
}

/**
 * Reservations whose *stay* overlaps the window. Occupancy has to be measured on the nights
 * consumed, so this is a different set from `fetchBookingsCreatedIn`.
 */
export async function fetchBookingsStayingIn(
  payload: Payload,
  range: AnalyticsRange,
): Promise<{ bookings: BookingRecord[] } & Truncatable> {
  const { docs, truncated } = await paginate(
    bookingsPage(payload, {
      and: [
        { checkInDate: { less_than: range.to.toISOString() } },
        { checkOutDate: { greater_than: range.from.toISOString() } },
      ],
    }),
  )
  return { bookings: docs.map(toBookingRecord), truncated }
}

export async function fetchPaymentsCreatedIn(
  payload: Payload,
  range: AnalyticsRange,
): Promise<{ payments: PaymentRecord[] } & Truncatable> {
  const { docs, truncated } = await paginate((page) =>
    payload.find({
      collection: 'payments',
      where: {
        createdAt: {
          greater_than_equal: range.from.toISOString(),
          less_than: range.to.toISOString(),
        },
      },
      depth: 0,
      limit: PAGE_SIZE,
      page,
      sort: 'id',
      overrideAccess: true,
    }),
  )

  return {
    payments: docs.map((doc) => ({
      id: doc.id,
      gateway: doc.gateway,
      status: doc.status,
      purpose: doc.purpose,
      amount: num(doc.amount),
      createdAt: doc.createdAt,
    })),
    truncated,
  }
}

/**
 * Every property, as a dimension table joined in memory. `description` is a Lexical tree and is
 * excluded so the payload stays small.
 */
export async function fetchProperties(payload: Payload): Promise<PropertyRecord[]> {
  const { docs } = await paginate((page) =>
    payload.find({
      collection: 'properties',
      depth: 0,
      limit: PAGE_SIZE,
      page,
      sort: 'id',
      overrideAccess: true,
      select: {
        name: true,
        address: true,
        tier: true,
        propertyType: true,
        status: true,
        trustBadges: true,
      },
    }),
  )

  return docs.map((doc) => ({
    id: doc.id,
    name: doc.name ?? `Property #${doc.id}`,
    city: doc.address?.city ?? '',
    tier: doc.tier ?? 'standard',
    propertyType: doc.propertyType ?? 'hotel',
    status: doc.status ?? 'draft',
    freeCancellation: Boolean(doc.trustBadges?.includes('free_cancellation')),
  }))
}

export async function fetchRoomTypes(payload: Payload): Promise<RoomTypeRecord[]> {
  const { docs } = await paginate((page) =>
    payload.find({
      collection: 'room-types',
      depth: 0,
      limit: PAGE_SIZE,
      page,
      sort: 'id',
      overrideAccess: true,
      select: { name: true, property: true },
    }),
  )

  return docs.map((doc) => ({
    id: doc.id,
    name: doc.name ?? `Room type #${doc.id}`,
    propertyId: relId(doc.property),
  }))
}

/** Active, bookable rooms only — inactive rooms cannot be sold so they are not supply. */
export async function fetchActiveRooms(payload: Payload): Promise<RoomRecord[]> {
  const { docs } = await paginate((page) =>
    payload.find({
      collection: 'rooms',
      where: { isActive: { not_equals: false } },
      depth: 0,
      limit: PAGE_SIZE,
      page,
      sort: 'id',
      overrideAccess: true,
      select: { property: true },
    }),
  )

  return docs.map((doc) => ({ id: doc.id, propertyId: relId(doc.property) }))
}

/** Current supply position. Counts are "as of now" — there are no historical snapshots. */
export function summarizeSupply(
  properties: PropertyRecord[],
  roomTypes: RoomTypeRecord[],
  rooms: RoomRecord[],
): SupplySnapshot {
  const approved = properties.filter((property) => property.status === 'approved')
  const approvedIds = new Set(approved.map((property) => property.id))

  return {
    approvedProperties: approved.length,
    pendingProperties: properties.filter((property) => property.status === 'pending').length,
    suspendedProperties: properties.filter((property) => property.status === 'suspended').length,
    activeRooms: rooms.filter((room) => room.propertyId && approvedIds.has(room.propertyId)).length,
    activeRoomTypes: roomTypes.filter(
      (roomType) => roomType.propertyId && approvedIds.has(roomType.propertyId),
    ).length,
    citiesCovered: new Set(approved.map((property) => property.city.trim()).filter(Boolean)).size,
  }
}

export function indexById<T extends { id: number }>(rows: T[]): Map<number, T> {
  return new Map(rows.map((row) => [row.id, row]))
}

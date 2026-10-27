import type { Payload, Where } from 'payload'
import { BOOKING_ACTIVE_STATUSES } from '../bookings/statuses'

/**
 * Room availability, expressed against a booking's `items` array.
 *
 * A booking holds one `items` row per physical room, so "is this room taken" is a query on
 * `items.room` rather than on a top-level column. Querying the top-level `room` mirror instead would
 * see only the first room of a multi-room booking and happily double-book the rest.
 */

export interface OverlapCheckInput {
  roomId: string | number
  checkInDate: string | Date
  checkOutDate: string | Date
  excludeBookingId?: string | number | null
}

function overlapConditions(args: {
  checkInDate: string | Date
  checkOutDate: string | Date
  excludeBookingId?: string | number | null
}): Where[] {
  const conditions: Where[] = [
    { status: { in: BOOKING_ACTIVE_STATUSES } },
    // Half-open intervals: a stay ending on the day another begins is not an overlap.
    { checkInDate: { less_than: new Date(args.checkOutDate) } },
    { checkOutDate: { greater_than: new Date(args.checkInDate) } },
  ]

  if (args.excludeBookingId) {
    conditions.push({ id: { not_equals: args.excludeBookingId } })
  }

  return conditions
}

export async function findOverlappingBookings(payload: Payload, input: OverlapCheckInput) {
  return payload.find({
    collection: 'bookings',
    where: {
      and: [{ 'items.room': { equals: input.roomId } }, ...overlapConditions(input)],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
}

export async function hasOverlappingBooking(
  payload: Payload,
  input: OverlapCheckInput,
): Promise<boolean> {
  const { totalDocs } = await findOverlappingBookings(payload, input)
  return totalDocs > 0
}

/**
 * Which of `roomIds` are already held over the range. One query for the whole candidate set, so
 * allocating N rooms costs one round trip instead of N.
 */
export async function findOverlappingBookingRooms(
  payload: Payload,
  args: {
    roomIds: (number | string)[]
    checkInDate: string | Date
    checkOutDate: string | Date
    excludeBookingId?: string | number | null
  },
): Promise<Set<number>> {
  if (args.roomIds.length === 0) return new Set()

  const { docs } = await payload.find({
    collection: 'bookings',
    where: {
      and: [{ 'items.room': { in: args.roomIds } }, ...overlapConditions(args)],
    },
    // A property's whole inventory could in principle be booked for the range.
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    select: { items: true },
  })

  const requested = new Set(args.roomIds.map((id) => Number(id)))
  const taken = new Set<number>()

  for (const booking of docs) {
    for (const item of booking.items ?? []) {
      const roomId = Number(typeof item.room === 'object' ? item.room?.id : item.room)
      // The query matches a whole booking, so it also returns rooms we never asked about.
      if (Number.isFinite(roomId) && requested.has(roomId)) taken.add(roomId)
    }
  }

  return taken
}

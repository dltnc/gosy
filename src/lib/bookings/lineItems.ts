import type { Payload } from 'payload'
import { APIError } from 'payload'

import { findOverlappingBookingRooms } from '../availability/checkOverlap'
import { computeNights } from '../pricing/computePricing'
import { MAX_ROOMS_PER_BOOKING } from './constants'

/**
 * Room allocation for multi-room bookings.
 *
 * A booking holds an `items` array in which **each row is one physical room** for the whole stay. A
 * guest who wants three rooms gets three rows; a guest mixing a Deluxe and a Suite gets one row of
 * each. Modelling quantity as repeated rows rather than a `quantity` number keeps the availability
 * rule honest — every row names a concrete `room`, so the overlap query stays a simple "is this room
 * already taken", and there is never a booking that claims two rooms without saying which two.
 *
 * Callers therefore ask for quantities and get rows back: `allocateRooms` expands
 * `[{ roomTypeId, quantity: 3 }]` into three rows bound to three distinct free rooms.
 */

export interface RequestedItem {
  roomTypeId: number | string
  quantity: number
}

export interface AllocatedItem {
  roomType: number
  room: number
  nightlyRate: number
  nights: number
  lineSubtotal: number
}

export interface AllocateArgs {
  checkInDate: string | Date
  checkOutDate: string | Date
  items: RequestedItem[]
  /** Ignore this booking's own rows when re-allocating an existing booking. */
  excludeBookingId?: number | string | null
}

/** Hard ceiling per booking, to keep one request from sweeping a small property's whole inventory. */
export { MAX_ROOMS_PER_BOOKING } from './constants'

export function normalizeRequestedItems(value: unknown): RequestedItem[] {
  if (!Array.isArray(value)) return []

  const merged = new Map<string, RequestedItem>()

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as { roomTypeId?: unknown; roomType?: unknown; quantity?: unknown }
    const roomTypeId = item.roomTypeId ?? item.roomType
    if (roomTypeId == null || roomTypeId === '') continue

    const quantity = Math.floor(Number(item.quantity ?? 1))
    if (!Number.isFinite(quantity) || quantity < 1) continue

    // The same room type sent twice is one line with the quantities added, not two competing lines.
    const key = String(roomTypeId)
    const existing = merged.get(key)
    if (existing) existing.quantity += quantity
    else merged.set(key, { roomTypeId: roomTypeId as number | string, quantity })
  }

  return [...merged.values()]
}

/**
 * Rooms of the given types that are free for the whole stay.
 *
 * One query per collection rather than per candidate room: the old code called the overlap check in a
 * loop, which meant a room type with 40 rooms cost 40 round trips to find the first free one.
 */
export async function findFreeRoomsByType(
  payload: Payload,
  args: {
    roomTypeIds: (number | string)[]
    checkInDate: string | Date
    checkOutDate: string | Date
    excludeBookingId?: number | string | null
  },
): Promise<Map<string, number[]>> {
  const { docs: rooms } = await payload.find({
    collection: 'rooms',
    where: {
      and: [{ roomType: { in: args.roomTypeIds } }, { isActive: { equals: true } }],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    sort: 'roomNumber',
  })

  const takenIds = await findOverlappingBookingRooms(payload, {
    roomIds: rooms.map((room) => room.id),
    checkInDate: args.checkInDate,
    checkOutDate: args.checkOutDate,
    excludeBookingId: args.excludeBookingId,
  })

  const byRoomType = new Map<string, number[]>()
  for (const room of rooms) {
    if (takenIds.has(room.id)) continue
    const key = String(typeof room.roomType === 'object' ? room.roomType?.id : room.roomType)
    const list = byRoomType.get(key)
    if (list) list.push(room.id)
    else byRoomType.set(key, [room.id])
  }

  return byRoomType
}

export interface AllocationResult {
  items: AllocatedItem[]
  /** Every row belongs to one property; callers need it because `property` is required on a booking. */
  propertyId: number
  nights: number
}

export async function allocateRooms(
  payload: Payload,
  args: AllocateArgs,
): Promise<AllocationResult> {
  const items = args.items
  if (items.length === 0) {
    throw new APIError('Select at least one room to book.', 400)
  }

  const totalRooms = items.reduce((sum, item) => sum + item.quantity, 0)
  if (totalRooms > MAX_ROOMS_PER_BOOKING) {
    throw new APIError(
      `A single booking can hold at most ${MAX_ROOMS_PER_BOOKING} rooms. Split the party across bookings.`,
      400,
    )
  }

  const nights = computeNights(args.checkInDate, args.checkOutDate)
  if (nights < 1) {
    throw new APIError('Check-out must be at least one night after check-in.', 400)
  }

  const roomTypeIds = items.map((item) => item.roomTypeId)
  const { docs: roomTypes } = await payload.find({
    collection: 'room-types',
    where: { id: { in: roomTypeIds } },
    limit: roomTypeIds.length,
    depth: 1,
    overrideAccess: true,
  })

  const roomTypesById = new Map(roomTypes.map((roomType) => [String(roomType.id), roomType]))
  const free = await findFreeRoomsByType(payload, {
    roomTypeIds,
    checkInDate: args.checkInDate,
    checkOutDate: args.checkOutDate,
    excludeBookingId: args.excludeBookingId,
  })

  const allocated: AllocatedItem[] = []
  let propertyId: number | null = null

  for (const item of items) {
    const roomType = roomTypesById.get(String(item.roomTypeId))
    if (!roomType) throw new APIError('One of the selected room types no longer exists.', 400)
    if (!roomType.isActive) {
      throw new APIError(`"${roomType.name}" is not currently bookable.`, 400)
    }

    const property = typeof roomType.property === 'object' ? roomType.property : null
    if (property && property.status !== 'approved') {
      throw new APIError('This property is not open for bookings.', 400)
    }

    // One booking is one stay at one property: a guest booking two hotels needs two bookings, since a
    // single `property`, invoice and partner payout cannot describe both.
    const itemPropertyId = Number(property ? property.id : roomType.property)
    if (propertyId != null && propertyId !== itemPropertyId) {
      throw new APIError('All rooms on one booking must belong to the same property.', 400)
    }
    propertyId = itemPropertyId

    const available = free.get(String(item.roomTypeId)) ?? []
    if (available.length < item.quantity) {
      throw new APIError(
        available.length === 0
          ? `"${roomType.name}" is no longer available for these dates.`
          : `Only ${available.length} "${roomType.name}" ${
              available.length === 1 ? 'room is' : 'rooms are'
            } left for these dates.`,
        409,
      )
    }

    const nightlyRate = roomType.basePrice
    for (let index = 0; index < item.quantity; index++) {
      allocated.push({
        roomType: Number(roomType.id),
        room: available[index]!,
        nightlyRate,
        nights,
        lineSubtotal: Math.round(nightlyRate * nights * 100) / 100,
      })
    }
    // Consume what we just took so two lines of the same type cannot claim one room.
    free.set(String(item.roomTypeId), available.slice(item.quantity))
  }

  if (propertyId == null || !Number.isFinite(propertyId)) {
    throw new APIError('The selected rooms are not attached to a property.', 400)
  }

  return { items: allocated, propertyId, nights }
}

/** Total heads a set of allocated rooms can legally sleep. */
export function totalMaxOccupancy(
  items: { roomType: number }[],
  maxOccupancyByRoomType: Map<string, number>,
): number {
  return items.reduce(
    (sum, item) => sum + (maxOccupancyByRoomType.get(String(item.roomType)) ?? 0),
    0,
  )
}

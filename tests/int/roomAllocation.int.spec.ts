import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { allocateRooms, normalizeRequestedItems } from '@/lib/bookings/lineItems'

/**
 * Room allocation: quantities in, one row per physical room out.
 *
 * Quantity is modelled as repeated rows rather than a `quantity` column so that every row names a
 * concrete room and the availability rule stays a simple "is this room taken". These tests pin that
 * expansion, the rate frozen onto each row, and the refusals — a shortfall, a mixed-property
 * selection, a room type that is switched off — with Payload stubbed out.
 */

interface RoomTypeStub {
  id: number
  name: string
  basePrice: number
  maxOccupancy?: number
  isActive?: boolean
  property?: { id: number; status?: string } | number
}

interface WorldStub {
  roomTypes: RoomTypeStub[]
  rooms: { id: number; roomType: number }[]
  takenRoomIds?: number[]
}

const STAY = { checkInDate: '2026-09-01', checkOutDate: '2026-09-03' }

function fakePayload(world: WorldStub): Payload {
  return {
    find: async ({ collection }: { collection: string }) => {
      if (collection === 'room-types') {
        return {
          docs: world.roomTypes.map((type) => ({
            isActive: true,
            maxOccupancy: 2,
            property: { id: 7, status: 'approved' },
            ...type,
          })),
        }
      }
      if (collection === 'rooms') {
        // `sort: 'roomNumber'` is the real ordering; the stub returns them in declaration order.
        return { docs: world.rooms.map((room) => ({ isActive: true, ...room })) }
      }
      if (collection === 'bookings') {
        return { docs: (world.takenRoomIds ?? []).map((id) => ({ items: [{ room: id }] })) }
      }
      return { docs: [] }
    },
  } as unknown as Payload
}

const DELUXE: RoomTypeStub = { id: 1, name: 'Deluxe Room', basePrice: 5000 }
const SUITE: RoomTypeStub = { id: 2, name: 'Suite', basePrice: 8000 }

describe('normalizeRequestedItems', () => {
  it('merges the same room type into one line', () => {
    expect(
      normalizeRequestedItems([
        { roomTypeId: 1, quantity: 2 },
        { roomTypeId: 1, quantity: 1 },
      ]),
    ).toEqual([{ roomTypeId: 1, quantity: 3 }])
  })

  it('accepts the `roomType` spelling and defaults a missing quantity to one', () => {
    expect(normalizeRequestedItems([{ roomType: 4 }])).toEqual([{ roomTypeId: 4, quantity: 1 }])
  })

  it('drops entries that cannot mean anything', () => {
    expect(
      normalizeRequestedItems([
        null,
        'nonsense',
        { quantity: 2 },
        { roomTypeId: '', quantity: 1 },
        { roomTypeId: 1, quantity: 0 },
        { roomTypeId: 1, quantity: -3 },
      ]),
    ).toEqual([])
    expect(normalizeRequestedItems('not an array')).toEqual([])
  })

  it('floors a fractional quantity', () => {
    expect(normalizeRequestedItems([{ roomTypeId: 1, quantity: 2.7 }])).toEqual([
      { roomTypeId: 1, quantity: 2 },
    ])
  })
})

describe('allocateRooms', () => {
  it('expands quantities into distinct rooms with the rate frozen on each row', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE, SUITE],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 102, roomType: 1 },
        { id: 201, roomType: 2 },
      ],
    })

    const result = await allocateRooms(payload, {
      ...STAY,
      items: [
        { roomTypeId: 1, quantity: 2 },
        { roomTypeId: 2, quantity: 1 },
      ],
    })

    expect(result.propertyId).toBe(7)
    expect(result.nights).toBe(2)
    expect(result.items).toEqual([
      { roomType: 1, room: 101, nightlyRate: 5000, nights: 2, lineSubtotal: 10000 },
      { roomType: 1, room: 102, nightlyRate: 5000, nights: 2, lineSubtotal: 10000 },
      { roomType: 2, room: 201, nightlyRate: 8000, nights: 2, lineSubtotal: 16000 },
    ])
  })

  it('never hands the same room to two lines', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [{ id: 101, roomType: 1 }] })

    // Two separate lines of one type, one free room: the second must not be given room 101 again.
    await expect(
      allocateRooms(payload, {
        ...STAY,
        items: [
          { roomTypeId: 1, quantity: 1 },
          { roomTypeId: 1, quantity: 1 },
        ],
      }),
    ).rejects.toThrow(/no longer available/i)
  })

  it('skips rooms already held over the range', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 102, roomType: 1 },
      ],
      takenRoomIds: [101],
    })

    const result = await allocateRooms(payload, {
      ...STAY,
      items: [{ roomTypeId: 1, quantity: 1 }],
    })

    expect(result.items.map((item) => item.room)).toEqual([102])
  })

  it('says how many rooms are actually left', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 102, roomType: 1 },
      ],
    })

    await expect(
      allocateRooms(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 3 }] }),
    ).rejects.toThrow(/Only 2 "Deluxe Room" rooms are left/)
  })
})

describe('selections allocation refuses', () => {
  it('rejects an empty selection', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [] })
    await expect(allocateRooms(payload, { ...STAY, items: [] })).rejects.toThrow(
      /at least one room/i,
    )
  })

  it('rejects more rooms than one booking may hold', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [] })
    await expect(
      allocateRooms(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 11 }] }),
    ).rejects.toThrow(/at most 10 rooms/i)
  })

  it('rejects a stay of no nights before touching inventory', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [{ id: 101, roomType: 1 }] })
    await expect(
      allocateRooms(payload, {
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-01',
        items: [{ roomTypeId: 1, quantity: 1 }],
      }),
    ).rejects.toThrow(/at least one night/i)
  })

  it('rejects a room type that is switched off', async () => {
    const payload = fakePayload({
      roomTypes: [{ ...DELUXE, isActive: false }],
      rooms: [{ id: 101, roomType: 1 }],
    })
    await expect(
      allocateRooms(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 1 }] }),
    ).rejects.toThrow(/not currently bookable/i)
  })

  it('rejects a property that is not approved', async () => {
    const payload = fakePayload({
      roomTypes: [{ ...DELUXE, property: { id: 7, status: 'pending' } }],
      rooms: [{ id: 101, roomType: 1 }],
    })
    await expect(
      allocateRooms(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 1 }] }),
    ).rejects.toThrow(/not open for bookings/i)
  })

  it('rejects rooms spread across two properties', async () => {
    // One booking is one stay: a single `property`, invoice and payout cannot describe two hotels.
    const payload = fakePayload({
      roomTypes: [DELUXE, { ...SUITE, property: { id: 9, status: 'approved' } }],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 201, roomType: 2 },
      ],
    })

    await expect(
      allocateRooms(payload, {
        ...STAY,
        items: [
          { roomTypeId: 1, quantity: 1 },
          { roomTypeId: 2, quantity: 1 },
        ],
      }),
    ).rejects.toThrow(/same property/i)
  })

  it('rejects a room type that no longer exists', async () => {
    const payload = fakePayload({ roomTypes: [], rooms: [] })
    await expect(
      allocateRooms(payload, { ...STAY, items: [{ roomTypeId: 99, quantity: 1 }] }),
    ).rejects.toThrow(/no longer exists/i)
  })
})

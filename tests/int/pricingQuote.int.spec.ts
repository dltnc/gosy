import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { buildQuote } from '@/lib/pricing/quote'

/**
 * The server quote for a room selection.
 *
 * `buildQuote` is the only price in the product: the booking panel shows it and checkout charges it,
 * so the two can never disagree. What matters here is that quantity and mixed room types are priced
 * per physical room, and that a sold-out selection comes back as an `issues` list rather than an
 * exception — the panel has to be able to say "only 2 left" instead of failing.
 *
 * Payload is stubbed: room types, rooms, the overlap query and the settings global are all just data.
 */

interface RoomTypeStub {
  id: number
  name: string
  basePrice: number
  maxOccupancy: number
  isActive?: boolean
  property?: number
}

interface WorldStub {
  roomTypes: RoomTypeStub[]
  rooms: { id: number; roomType: number }[]
  /** Rooms already held over the range by an active booking. */
  takenRoomIds?: number[]
  commissionRate?: number | null
}

const STAY = { checkInDate: '2026-09-01', checkOutDate: '2026-09-03' }

function fakePayload(world: WorldStub): Payload {
  return {
    find: async ({ collection }: { collection: string }) => {
      if (collection === 'room-types') {
        return { docs: world.roomTypes.map((type) => ({ isActive: true, property: 7, ...type })) }
      }
      if (collection === 'rooms') {
        return { docs: world.rooms.map((room) => ({ isActive: true, property: 7, ...room })) }
      }
      if (collection === 'bookings') {
        return { docs: (world.takenRoomIds ?? []).map((id) => ({ items: [{ room: id }] })) }
      }
      return { docs: [] }
    },
    findGlobal: async () => ({
      currency: 'BDT',
      defaultCommissionRate: 10,
      loyaltyProgram: {
        enabled: false,
        redeemRate: 0,
        minRedeemPoints: 0,
        maxRedeemPercentOfBooking: 0,
      },
    }),
    findByID: async ({ collection }: { collection: string }) =>
      collection === 'properties'
        ? { commissionRateOverride: world.commissionRate ?? null }
        : { pointsBalance: 0 },
  } as unknown as Payload
}

const DELUXE: RoomTypeStub = { id: 1, name: 'Deluxe Room', basePrice: 5000, maxOccupancy: 2 }
const SUITE: RoomTypeStub = { id: 2, name: 'Suite', basePrice: 8000, maxOccupancy: 4 }

describe('multi-room pricing', () => {
  it('prices every physical room, across mixed room types', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE, SUITE],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 102, roomType: 1 },
        { id: 201, roomType: 2 },
      ],
    })

    const quote = await buildQuote(payload, {
      ...STAY,
      items: [
        { roomTypeId: 1, quantity: 2 },
        { roomTypeId: 2, quantity: 1 },
      ],
      adults: 4,
    })

    expect(quote.nights).toBe(2)
    expect(quote.rooms).toBe(3)
    expect(quote.lines.map((line) => line.lineSubtotal)).toEqual([20000, 16000])

    // (5000 + 5000 + 8000) × 2 nights — not one room's worth, and not an averaged rate.
    expect(quote.pricing.subtotal).toBe(36000)
    expect(quote.pricing.commissionAmount).toBe(3600)
    expect(quote.pricing.partnerPayoutAmount).toBe(32400)
    expect(quote.issues).toEqual([])
  })

  it("honours a property's commission override", async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE],
      rooms: [{ id: 101, roomType: 1 }],
      commissionRate: 20,
    })

    const quote = await buildQuote(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 1 }] })
    expect(quote.pricing.commissionAmount).toBe(2000)
  })
})

describe('availability in a quote', () => {
  it('reports a shortfall instead of throwing, and still prices the stay', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 102, roomType: 1 },
      ],
    })

    const quote = await buildQuote(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 3 }] })

    expect(quote.lines[0]?.available).toBe(2)
    expect(quote.issues).toEqual(['Only 2 "Deluxe Room" rooms are left for these dates.'])
    // The panel needs a number to show next to the warning.
    expect(quote.pricing.subtotal).toBe(30000)
  })

  it('excludes rooms already held over the range', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 102, roomType: 1 },
      ],
      takenRoomIds: [101, 102],
    })

    const quote = await buildQuote(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 1 }] })

    expect(quote.lines[0]?.available).toBe(0)
    expect(quote.issues).toEqual(['"Deluxe Room" is not available for these dates.'])
  })

  it('flags a room type that is switched off', async () => {
    const payload = fakePayload({
      roomTypes: [{ ...DELUXE, isActive: false }],
      rooms: [{ id: 101, roomType: 1 }],
    })

    const quote = await buildQuote(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 1 }] })
    expect(quote.issues).toEqual(['"Deluxe Room" is not currently bookable.'])
  })
})

describe('capacity across the whole selection', () => {
  it('adds up occupancy per room, so a big party fits in enough rooms', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 102, roomType: 1 },
      ],
    })

    const quote = await buildQuote(payload, {
      ...STAY,
      items: [{ roomTypeId: 1, quantity: 2 }],
      adults: 3,
      children: 1,
    })

    expect(quote.capacity).toEqual({ guests: 4, maxGuests: 4, fits: true })
    expect(quote.issues).toEqual([])
  })

  it('says how many the rooms sleep when the party is too big', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [{ id: 101, roomType: 1 }] })

    const quote = await buildQuote(payload, {
      ...STAY,
      items: [{ roomTypeId: 1, quantity: 1 }],
      adults: 3,
    })

    expect(quote.capacity.fits).toBe(false)
    expect(quote.issues).toEqual([
      'The selected rooms sleep 2 guests; add another room for a party of 3.',
    ])
  })
})

describe('requests a quote cannot answer', () => {
  it('rejects an empty selection', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [] })
    await expect(buildQuote(payload, { ...STAY, items: [] })).rejects.toThrow(/at least one room/i)
  })

  it('rejects more rooms than one booking may hold', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [{ id: 101, roomType: 1 }] })
    await expect(
      buildQuote(payload, { ...STAY, items: [{ roomTypeId: 1, quantity: 11 }] }),
    ).rejects.toThrow(/at most 10 rooms/i)
  })

  it('rejects a stay of no nights', async () => {
    const payload = fakePayload({ roomTypes: [DELUXE], rooms: [{ id: 101, roomType: 1 }] })
    await expect(
      buildQuote(payload, {
        checkInDate: '2026-09-01',
        checkOutDate: '2026-09-01',
        items: [{ roomTypeId: 1, quantity: 1 }],
      }),
    ).rejects.toThrow(/at least one night/i)
  })

  it('rejects a selection that spans two properties', async () => {
    const payload = fakePayload({
      roomTypes: [DELUXE, { ...SUITE, property: 9 }],
      rooms: [
        { id: 101, roomType: 1 },
        { id: 201, roomType: 2 },
      ],
    })

    await expect(
      buildQuote(payload, {
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
      buildQuote(payload, { ...STAY, items: [{ roomTypeId: 99, quantity: 1 }] }),
    ).rejects.toThrow(/no longer exists/i)
  })
})

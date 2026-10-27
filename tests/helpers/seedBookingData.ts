import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

export interface SeedResult {
  runId: string
  partnerEmail: string
  guest: { email: string; password: string }
  propertyId: number
  propertySlug: string
  roomTypeId: number
  /** Every physical room seeded for the type, so multi-room selections have inventory to allocate. */
  roomIds: number[]
}

/**
 * Seeds a complete bookable inventory chain (partner → property → room type → rooms
 * plus a guest account) for e2e booking-flow tests.
 *
 * Two rooms of the type, not one: a booking holds one row per physical room, so a two-room selection
 * needs two free rooms or allocation fails before the flow is exercised.
 */
export async function seedBookingData(): Promise<SeedResult> {
  const payload = await getPayload({ config })
  const runId = Date.now().toString(36)

  const partner = await payload.create({
    collection: 'users',
    data: {
      email: `e2e-partner-${runId}@test.local`,
      password: 'password123',
      role: 'partner',
      name: 'E2E Partner',
    },
    overrideAccess: true,
  })

  const guest = await payload.create({
    collection: 'users',
    data: {
      email: `e2e-guest-${runId}@test.local`,
      password: 'password123',
      role: 'guest',
      name: 'E2E Guest',
      phone: `+8801${Math.floor(10000000 + Math.random() * 89999999)}`,
    },
    overrideAccess: true,
  })

  const property = await payload.create({
    collection: 'properties',
    data: {
      name: `E2E Hotel ${runId}`,
      slug: `e2e-hotel-${runId}`,
      partner: partner.id,
      status: 'approved',
      tier: 'standard',
      address: { city: "Cox's Bazar", country: 'Bangladesh' },
      location: [91.9708, 21.4272],
    },
    overrideAccess: true,
  })

  const roomType = await payload.create({
    collection: 'room-types',
    data: {
      property: property.id,
      name: 'Deluxe Double',
      basePrice: 5000,
      maxOccupancy: 2,
    },
    overrideAccess: true,
  })

  const rooms = await Promise.all(
    ['A', 'B'].map((suffix) =>
      payload.create({
        collection: 'rooms',
        data: {
          property: property.id,
          roomType: roomType.id,
          roomNumber: `E2E-${runId}-${suffix}`,
        },
        overrideAccess: true,
      }),
    ),
  )

  return {
    runId,
    partnerEmail: partner.email,
    guest: { email: guest.email, password: 'password123' },
    propertyId: Number(property.id),
    propertySlug: property.slug,
    roomTypeId: Number(roomType.id),
    roomIds: rooms.map((room) => Number(room.id)),
  }
}

function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10)
}

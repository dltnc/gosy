import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

let payload: Payload

const runId = Date.now().toString(36)
const emails = {
  admin: `it-admin-${runId}@test.local`,
  partner: `it-partner-${runId}@test.local`,
  guest: `it-guest-${runId}@test.local`,
}

let adminId: number
let partnerId: number
let guestId: number
let propertyId: number
let roomTypeId: number
let roomId: number
let secondRoomId: number

const DAY = 86_400_000

function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * DAY).toISOString()
}

/**
 * One booked room. The `roomType` is derived from the room by a beforeValidate hook, but the
 * generated create type still asks for it, so tests pass the value the hook would compute anyway.
 */
function roomItem(room: number) {
  return { room, roomType: roomTypeId }
}

/** Relationship fields come back as an id or a populated doc depending on depth. */
function idOf(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return Number((value as { id: unknown }).id)
  }
  return undefined
}

async function safeDelete(
  collection: Parameters<Payload['delete']>[0]['collection'],
  where: Record<string, unknown>,
) {
  await payload
    .delete({ collection, where: where as never, overrideAccess: true })
    .catch(() => undefined)
}

beforeAll(async () => {
  const payloadConfig = await config
  payload = await getPayload({ config: payloadConfig })

  const admin = await payload.create({
    collection: 'users',
    data: { email: emails.admin, password: 'password123', role: 'admin', name: 'IT Admin' },
    overrideAccess: true,
  })
  adminId = admin.id

  const partner = await payload.create({
    collection: 'users',
    data: { email: emails.partner, password: 'password123', role: 'partner', name: 'IT Partner' },
    overrideAccess: true,
  })
  partnerId = partner.id

  const guest = await payload.create({
    collection: 'users',
    data: { email: emails.guest, password: 'password123', role: 'guest', name: 'IT Guest' },
    overrideAccess: true,
  })
  guestId = guest.id

  const property = await payload.create({
    collection: 'properties',
    data: {
      name: `IT Property ${runId}`,
      slug: `it-property-${runId}`,
      partner: partnerId,
      status: 'approved',
      tier: 'premium',
      address: { city: "Cox's Bazar", country: 'Bangladesh' },
      location: [91.9708, 21.4272],
    },
    overrideAccess: true,
  })
  propertyId = property.id

  const roomType = await payload.create({
    collection: 'room-types',
    data: { property: propertyId, name: 'Deluxe Double', basePrice: 5000, maxOccupancy: 2 },
    overrideAccess: true,
  })
  roomTypeId = roomType.id

  const room = await payload.create({
    collection: 'rooms',
    data: { property: propertyId, roomType: roomTypeId, roomNumber: `IT-${runId}` },
    overrideAccess: true,
  })
  roomId = room.id

  // A second physical room of the same type, so multi-room bookings have something to allocate.
  const secondRoom = await payload.create({
    collection: 'rooms',
    data: { property: propertyId, roomType: roomTypeId, roomNumber: `IT-${runId}-B` },
    overrideAccess: true,
  })
  secondRoomId = secondRoom.id
})

describe('bookings domain', () => {
  it('computes pricing server-side with commission snapshot', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(10),
        checkOutDate: futureDate(13),
        adults: 2,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    expect(booking.bookingRef).toMatch(/^BK-/)
    expect(booking.pricing?.nights).toBe(3)
    expect(booking.pricing?.subtotal).toBe(15000)
    expect(booking.pricing?.commissionRate).toBe(10)
    expect(booking.pricing?.commissionAmount).toBe(1500)
    expect(booking.pricing?.partnerPayoutAmount).toBe(13500)

    await payload.delete({ collection: 'bookings', id: booking.id, overrideAccess: true })
  })

  it('prices each room on a multi-room booking and mirrors the first row', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId), roomItem(secondRoomId)],
        property: propertyId,
        checkInDate: futureDate(100),
        checkOutDate: futureDate(103),
        adults: 4,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    expect(booking.items).toHaveLength(2)
    for (const item of booking.items ?? []) {
      expect(item.nightlyRate).toBe(5000)
      expect(item.nights).toBe(3)
      expect(item.lineSubtotal).toBe(15000)
    }

    // Two rooms × 5000 × 3 nights, not one room's worth.
    expect(booking.pricing?.subtotal).toBe(30000)
    expect(booking.pricing?.commissionAmount).toBe(3000)
    expect(booking.pricing?.partnerPayoutAmount).toBe(27000)

    // The legacy single-room columns mirror the first row so old readers still resolve.
    expect(idOf(booking.room)).toBe(roomId)
    expect(idOf(booking.roomType)).toBe(roomTypeId)

    await payload.delete({ collection: 'bookings', id: booking.id, overrideAccess: true })
  })

  it('rejects the same room twice on one booking', async () => {
    await expect(
      payload.create({
        collection: 'bookings',
        data: {
          guest: guestId,
          items: [roomItem(roomId), roomItem(roomId)],
          property: propertyId,
          checkInDate: futureDate(110),
          checkOutDate: futureDate(112),
          adults: 2,
        },
        overrideAccess: true,
        context: { skipBookingSideEffects: true },
      }),
    ).rejects.toThrow(/same room cannot be booked twice/i)
  })

  it('measures party capacity across every room booked', async () => {
    // One double sleeps 2, so a party of 4 needs the second room — and 5 fits in neither.
    await expect(
      payload.create({
        collection: 'bookings',
        data: {
          guest: guestId,
          items: [roomItem(roomId)],
          property: propertyId,
          checkInDate: futureDate(120),
          checkOutDate: futureDate(122),
          adults: 4,
        },
        overrideAccess: true,
        context: { skipBookingSideEffects: true },
      }),
    ).rejects.toThrow(/sleep 2 guests/i)

    await expect(
      payload.create({
        collection: 'bookings',
        data: {
          guest: guestId,
          items: [roomItem(roomId), roomItem(secondRoomId)],
          property: propertyId,
          checkInDate: futureDate(120),
          checkOutDate: futureDate(122),
          adults: 4,
          children: 1,
        },
        overrideAccess: true,
        context: { skipBookingSideEffects: true },
      }),
    ).rejects.toThrow(/sleep 4 guests/i)
  })

  it('rejects overlapping active bookings on the same room', async () => {
    const first = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(20),
        checkOutDate: futureDate(23),
        adults: 2,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    await expect(
      payload.create({
        collection: 'bookings',
        data: {
          guest: guestId,
          items: [roomItem(roomId)],
          property: propertyId,
          checkInDate: futureDate(21),
          checkOutDate: futureDate(24),
          adults: 2,
        },
        overrideAccess: true,
        context: { skipBookingSideEffects: true },
      }),
    ).rejects.toThrow(/no longer available/i)

    await payload.update({
      collection: 'bookings',
      id: first.id,
      data: { status: 'cancelled_by_guest' },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })
    await payload.delete({ collection: 'bookings', id: first.id, overrideAccess: true })
  })

  it('allows rebooking cancelled date ranges', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(40),
        checkOutDate: futureDate(43),
        adults: 2,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'cancelled_by_guest' },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    const second = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(40),
        checkOutDate: futureDate(43),
        adults: 2,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    expect(second.pricing?.subtotal).toBe(15000)
    await payload.delete({ collection: 'bookings', id: second.id, overrideAccess: true })
  })

  it('validates points redemption against balance and caps', async () => {
    await payload.create({
      collection: 'loyalty-points',
      data: { user: guestId, type: 'adjust', amount: 5000, notes: `seed ${runId}` },
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'bookings',
        data: {
          guest: guestId,
          items: [roomItem(roomId)],
          property: propertyId,
          checkInDate: futureDate(50),
          checkOutDate: futureDate(53),
          adults: 2,
          pointsRedeemed: 99999,
        },
        overrideAccess: true,
        context: { skipBookingSideEffects: true },
      }),
    ).rejects.toThrow(/enough loyalty points/i)

    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(50),
        checkOutDate: futureDate(53),
        adults: 2,
        pointsRedeemed: 2000,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    expect(booking.pricing?.pointsDiscountAmount).toBe(1000)
    expect(booking.pricing?.totalAmount).toBe(14000)

    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'confirmed' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'checked_in' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'checked_out' },
      overrideAccess: true,
    })

    const { docs: ledger } = await payload.find({
      collection: 'loyalty-points',
      where: { sourceBooking: { equals: booking.id } },
      overrideAccess: true,
    })
    const earnRow = ledger.find((l) => l.type === 'earn')
    expect(earnRow?.amount).toBe(140)

    const updatedGuest = await payload.findByID({
      collection: 'users',
      id: guestId,
      overrideAccess: true,
    })
    expect(updatedGuest.pointsBalance).toBe(5140)

    await expect(
      payload.update({
        collection: 'bookings',
        id: booking.id,
        data: { status: 'pending_payment' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()

    await payload.delete({ collection: 'bookings', id: booking.id, overrideAccess: true })
  })

  it('debits redeemed points on create and returns them when cancelled', async () => {
    await payload.create({
      collection: 'loyalty-points',
      data: { user: guestId, type: 'adjust', amount: 3000, notes: `redeem-seed ${runId}` },
      overrideAccess: true,
    })

    const before = await payload.findByID({
      collection: 'users',
      id: guestId,
      depth: 0,
      overrideAccess: true,
    })
    const startingBalance = before.pointsBalance ?? 0

    // Deliberately no skipBookingSideEffects: the debit is what's under test.
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(90),
        checkOutDate: futureDate(93),
        adults: 2,
        pointsRedeemed: 2000,
      },
      overrideAccess: true,
    })

    expect(booking.pricing?.pointsDiscountAmount).toBe(1000)

    const redeemRows = await payload.find({
      collection: 'loyalty-points',
      where: { and: [{ sourceBooking: { equals: booking.id } }, { type: { equals: 'redeem' } }] },
      overrideAccess: true,
    })
    expect(redeemRows.totalDocs).toBe(1)
    expect(redeemRows.docs[0]?.amount).toBe(-2000)

    const afterDebit = await payload.findByID({
      collection: 'users',
      id: guestId,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterDebit.pointsBalance).toBe(startingBalance - 2000)

    await payload.update({
      collection: 'bookings',
      id: booking.id,
      data: { status: 'cancelled_by_guest' },
      overrideAccess: true,
    })

    const afterCancel = await payload.findByID({
      collection: 'users',
      id: guestId,
      depth: 0,
      overrideAccess: true,
    })
    expect(afterCancel.pointsBalance).toBe(startingBalance)

    await payload.delete({ collection: 'bookings', id: booking.id, overrideAccess: true })
  })

  it('requires a verifier before marking manual payments successful', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(60),
        checkOutDate: futureDate(63),
        adults: 2,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    await expect(
      payload.create({
        collection: 'payments',
        data: {
          purpose: 'booking_payment',
          gateway: 'bank_transfer',
          status: 'success',
          amount: booking.pricing?.totalAmount ?? 0,
          currency: 'BDT',
          booking: booking.id,
          bankTransferDetails: { transferReference: `IT-${runId}` },
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/verifier/i)

    await payload.delete({ collection: 'bookings', id: booking.id, overrideAccess: true })
  })

  it('cascades booking to confirmed when its payment succeeds', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(70),
        checkOutDate: futureDate(73),
        adults: 2,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    const payment = await payload.create({
      collection: 'payments',
      data: {
        purpose: 'booking_payment',
        gateway: 'bank_transfer',
        status: 'success',
        amount: booking.pricing?.totalAmount ?? 0,
        currency: 'BDT',
        booking: booking.id,
        verifiedBy: adminId,
        bankTransferDetails: { transferReference: `CASCADE-${runId}` },
      },
      overrideAccess: true,
    })

    void payment

    const refreshed = await payload.findByID({
      collection: 'bookings',
      id: booking.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(refreshed.status).toBe('confirmed')

    await payload.delete({ collection: 'payments', id: payment.id, overrideAccess: true })
    await payload.delete({ collection: 'bookings', id: booking.id, overrideAccess: true })
  })

  it('expires abandoned pending_payment bookings past the grace window', async () => {
    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        items: [roomItem(roomId)],
        property: propertyId,
        checkInDate: futureDate(80),
        checkOutDate: futureDate(83),
        adults: 2,
      },
      overrideAccess: true,
      context: { skipBookingSideEffects: true },
    })

    const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    await payload.db.drizzle.execute(
      `UPDATE bookings SET updated_at = '${stale}' WHERE id = ${booking.id}`,
    )

    const job = await payload.jobs.queue({ task: 'expireAbandonedBookings', input: {} })
    await payload.jobs.runByID({ id: job.id })

    const refreshed = await payload.findByID({
      collection: 'bookings',
      id: booking.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(refreshed.status).toBe('cancelled_by_guest')

    await payload.delete({ collection: 'bookings', id: booking.id, overrideAccess: true })
  })
})

afterAll(async () => {
  if (!payload) return
  await safeDelete('bookings', { guest: { equals: guestId } })
  await safeDelete('loyalty-points', { user: { equals: guestId } })
  await safeDelete('rooms', { property: { equals: propertyId } })
  await safeDelete('room-types', { property: { equals: propertyId } })
  await safeDelete('properties', { id: { equals: propertyId } })
  await safeDelete('users', { email: { in: Object.values(emails) } })
})

import { test, expect } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { seedBookingData, type SeedResult } from '../helpers/seedBookingData'

test.describe('Booking flow', () => {
  let seed: SeedResult

  test.beforeAll(async () => {
    seed = await seedBookingData()
  })

  async function loginAsGuest(page: import('@playwright/test').Page) {
    await page.goto('http://localhost:3000/login')
    await page.getByLabel('Email Address').fill(seed.guest.email)
    await page.getByLabel('Password', { exact: true }).fill(seed.guest.password)
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 60_000 }),
      page.getByRole('button', { name: 'Log in' }).click(),
    ])
  }

  function dates() {
    return {
      checkIn: new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10),
    }
  }

  async function findGuestId(): Promise<number> {
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: seed.guest.email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return Number(docs[0].id)
  }

  test('property detail shows room types and booking entry point', async ({ page }) => {
    await page.goto(`http://localhost:3000/property/${seed.propertySlug}`)
    await expect(page.getByRole('heading', { name: `E2E Hotel ${seed.runId}` })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Available accommodations' })).toBeVisible()
    await expect(page.getByText('৳5,000').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Book Now' }).first()).toBeVisible()
  })

  test('guest books via bank transfer and sees it pending in dashboard', async ({ page }) => {
    const { checkIn, checkOut } = dates()

    await loginAsGuest(page)

    // Checkout takes a whole selection — `roomTypeId:quantity` — not a single room type in the path.
    await page.goto(
      `http://localhost:3000/book?rooms=${seed.roomTypeId}:1&checkIn=${checkIn}&checkOut=${checkOut}&adults=2`,
    )
    await expect(page.getByRole('heading', { name: 'Complete your booking' })).toBeVisible()
    await page.getByRole('button', { name: /Continue to Payment/ }).click()
    await expect(page.getByText('5,000').first()).toBeVisible()

    await page.getByRole('button', { name: 'Bank Transfer' }).click()
    await page.getByPlaceholder(/TrxID/).fill(`E2E-TRX-${seed.runId}`)
    await page.locator('button[role="checkbox"]').last().click()
    await page.getByRole('button', { name: /Pay & Confirm Booking/ }).click()

    await expect(page.getByText('Transfer details received')).toBeVisible({ timeout: 60_000 })

    await page.goto('http://localhost:3000/dashboard/bookings')
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()
    await expect(page.getByText('pending payment').first()).toBeVisible({ timeout: 60_000 })
  })

  test('verified payment flips booking to confirmed and UI reflects it', async ({ page }) => {
    test.setTimeout(90_000)
    const payload = await getPayload({ config })
    // Different dates than the bank-transfer test — both use the same seeded room.
    const checkIn = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
    const checkOut = new Date(Date.now() + 16 * 86_400_000).toISOString().slice(0, 10)

    const guestId = await findGuestId()
    const { docs: rooms } = await payload.find({
      collection: 'rooms',
      where: { 'property.slug': { equals: seed.propertySlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const seededRoom = rooms[0]
    const roomPropertyId =
      typeof seededRoom.property === 'object' ? seededRoom.property.id : seededRoom.property

    const booking = await payload.create({
      collection: 'bookings',
      data: {
        guest: guestId,
        // One row per physical room; `property` and the single-room mirrors are derived, and the
        // hook re-derives `roomType` from the room — it is only here because the type asks for it.
        items: [{ room: seededRoom.id, roomType: seed.roomTypeId }],
        property: Number(roomPropertyId),
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: 2,
      },
      overrideAccess: true,
      draft: false,
    })
    expect(booking.status).toBe('pending_payment')
    expect(booking.pricing?.totalAmount).toBe(10000)

    const admin = (
      await payload.find({
        collection: 'users',
        where: { role: { equals: 'admin' } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]

    const payment = await payload.create({
      collection: 'payments',
      data: {
        purpose: 'booking_payment',
        gateway: 'bank_transfer',
        status: 'initiated',
        amount: booking.pricing!.totalAmount!,
        currency: booking.currency ?? 'BDT',
        booking: booking.id,
      },
      overrideAccess: true,
      context: { skipPaymentCascade: true },
    })

    // Bank transfers must require a verifier before success (collection rule).
    await payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: 'success',
        verifiedBy: admin.id,
        verifiedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    const confirmed = await payload.findByID({
      collection: 'bookings',
      id: booking.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(confirmed.status).toBe('confirmed')

    await loginAsGuest(page)
    await page.goto('http://localhost:3000/dashboard/bookings')
    await expect(page.getByText('confirmed').first()).toBeVisible()
  })
})

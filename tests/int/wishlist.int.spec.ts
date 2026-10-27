import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, afterAll, expect } from 'vitest'

import { getWishlistedPropertyIds } from '@/lib/wishlist'

let payload: Payload

const runId = Date.now().toString(36)
const emails = {
  partner: `it-wl-partner-${runId}@test.local`,
  guestA: `it-wl-guest-a-${runId}@test.local`,
  guestB: `it-wl-guest-b-${runId}@test.local`,
}

let guestA: Record<string, unknown> & { id: number }
let guestB: Record<string, unknown> & { id: number }
const propertyIds: number[] = []

async function safeDelete(collection: Parameters<Payload['delete']>[0]['collection'], where: Record<string, unknown>) {
  await payload.delete({ collection, where: where as never, overrideAccess: true }).catch(() => undefined)
}

beforeAll(async () => {
  const payloadConfig = await config
  payload = await getPayload({ config: payloadConfig })

  const partner = await payload.create({
    collection: 'users',
    data: { email: emails.partner, password: 'password123', role: 'partner', name: 'WL Partner' },
    overrideAccess: true,
  })

  const createdGuests = []
  for (const [email, name] of [
    [emails.guestA, 'WL Guest A'],
    [emails.guestB, 'WL Guest B'],
  ] as const) {
    createdGuests.push(
      await payload.create({
        collection: 'users',
        data: { email, password: 'password123', role: 'guest', name },
        overrideAccess: true,
      }),
    )
  }
  guestA = { ...createdGuests[0], collection: 'users' }
  guestB = { ...createdGuests[1], collection: 'users' }

  for (const index of [1, 2]) {
    const property = await payload.create({
      collection: 'properties',
      data: {
        name: `WL Property ${index} ${runId}`,
        slug: `wl-property-${index}-${runId}`,
        partner: partner.id,
        status: 'approved',
        tier: 'standard',
        address: { city: "Cox's Bazar", country: 'Bangladesh' },
        location: [91.9708, 21.4272],
      },
      overrideAccess: true,
    })
    propertyIds.push(property.id)
  }

  await payload.create({
    collection: 'wishlist',
    data: { guest: guestA.id, property: propertyIds[0] },
    overrideAccess: true,
  })
})

describe('wishlist domain', () => {
  it('rejects duplicate saves of the same stay', async () => {
    await expect(
      payload.create({
        collection: 'wishlist',
        data: { guest: guestA.id, property: propertyIds[0] },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/already in your wishlist/i)
  })

  it('scopes reads to the owning guest', async () => {
    const ownView = await payload.find({
      collection: 'wishlist',
      depth: 0,
      overrideAccess: false,
      user: guestA,
    })
    expect(ownView.docs).toHaveLength(1)
    expect(Number(ownView.docs[0].property)).toBe(propertyIds[0])

    const otherView = await payload.find({
      collection: 'wishlist',
      depth: 0,
      overrideAccess: false,
      user: guestB,
    })
    expect(otherView.docs).toHaveLength(0)
  })

  it('blocks updates to saved entries', async () => {
    const { docs } = await payload.find({
      collection: 'wishlist',
      where: { guest: { equals: guestA.id } },
      depth: 0,
      overrideAccess: true,
    })

    await expect(
      payload.update({
        collection: 'wishlist',
        id: docs[0].id,
        data: { property: propertyIds[1] },
        overrideAccess: false,
        user: guestA,
      }),
    ).rejects.toThrow()
  })

  it('resolves wishlisted property ids per guest', async () => {
    const ids = await getWishlistedPropertyIds(payload, guestA.id)
    expect([...ids]).toEqual([propertyIds[0]])

    const empty = await getWishlistedPropertyIds(payload, guestB.id)
    expect(empty.size).toBe(0)
  })
})

afterAll(async () => {
  if (!payload) return
  await safeDelete('wishlist', { guest: { in: [guestA.id, guestB.id] } })
  await safeDelete('properties', { id: { in: propertyIds } })
  await safeDelete('users', { email: { in: Object.values(emails) } })
})

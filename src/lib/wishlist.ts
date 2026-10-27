import type { Payload } from 'payload'

export async function getWishlistedPropertyIds(
  payload: Payload,
  userId: number | string,
): Promise<Set<number>> {
  const { docs } = await payload.find({
    collection: 'wishlist',
    where: { guest: { equals: userId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return new Set(docs.map((doc) => Number(doc.property)))
}

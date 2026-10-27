import type { Payload } from 'payload'

export async function getPartnerPropertyIds(
  payload: Payload,
  partnerId: string | number,
): Promise<(string | number)[]> {
  const { docs } = await payload.find({
    collection: 'properties',
    where: { partner: { equals: partnerId } },
    limit: 0,
    depth: 0,
  })
  return docs.map((d) => d.id)
}

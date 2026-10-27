import type { TaskConfig } from 'payload'

const ACTIVE_AND_DONE_STATUSES = [
  'pending_payment',
  'confirmed',
  'checked_in',
  'checked_out',
] as const

export const recomputeSocialProof: TaskConfig<'recomputeSocialProof'> = {
  slug: 'recomputeSocialProof',
  label: 'Recompute Social Proof',
  inputSchema: [],
  outputSchema: [{ name: 'updated', type: 'number' }],
  schedule: [{ cron: '0 */15 * * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000)

    const { docs: properties } = await req.payload.find({
      collection: 'properties',
      where: { status: { equals: 'approved' } },
      limit: 500,
      depth: 0,
    })

    for (const property of properties) {
      const [today, last6h] = await Promise.all([
        req.payload.count({
          collection: 'bookings',
          where: {
            and: [
              { property: { equals: property.id } },
              { createdAt: { greater_than_equal: startOfToday.toISOString() } },
              { status: { in: [...ACTIVE_AND_DONE_STATUSES] } },
            ],
          },
        }),
        req.payload.count({
          collection: 'bookings',
          where: {
            and: [
              { property: { equals: property.id } },
              { createdAt: { greater_than_equal: sixHoursAgo.toISOString() } },
              { status: { in: [...ACTIVE_AND_DONE_STATUSES] } },
            ],
          },
        }),
      ])

      await req.payload.update({
        collection: 'properties',
        id: property.id,
        data: {
          socialProof: { bookingsToday: today.totalDocs, bookingsLast6Hours: last6h.totalDocs },
        },
        overrideAccess: true,
        context: { skipHooks: true },
      })
    }

    return { output: { updated: properties.length } }
  },
}

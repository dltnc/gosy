import type { TaskConfig } from 'payload'

export const expireSubscriptions: TaskConfig<'expireSubscriptions'> = {
  slug: 'expireSubscriptions',
  label: 'Expire Property Subscriptions',
  inputSchema: [],
  outputSchema: [{ name: 'expired', type: 'number' }],
  schedule: [{ cron: '0 0 3 * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    const today = new Date().toISOString()

    const { docs } = await req.payload.find({
      collection: 'property-subscriptions',
      where: {
        and: [
          { status: { equals: 'active' } },
          { endDate: { exists: true, less_than: today } },
        ],
      },
      limit: 100,
      depth: 0,
    })

    for (const subscription of docs) {
      await req.payload.update({
        collection: 'property-subscriptions',
        id: subscription.id,
        data: { status: 'expired' },
        overrideAccess: true,
      })
    }

    return { output: { expired: docs.length } }
  },
}

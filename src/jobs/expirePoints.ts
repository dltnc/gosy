import type { TaskConfig, Where } from 'payload'

export const expirePoints: TaskConfig<'expirePoints'> = {
  slug: 'expirePoints',
  label: 'Expire Loyalty Points',
  inputSchema: [],
  outputSchema: [{ name: 'posted', type: 'number' }],
  schedule: [{ cron: '0 0 3 * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    const today = new Date().toISOString().slice(0, 10)

    const { docs: expiredEarns } = await req.payload.find({
      collection: 'loyalty-points',
      where: {
        and: [
          { type: { equals: 'earn' } },
          { expiresAt: { exists: true, less_than: today } },
        ],
      },
      limit: 500,
      depth: 0,
    })

    let posted = 0

    for (const earn of expiredEarns) {
      const conditions: Where[] = [
        { user: { equals: typeof earn.user === 'object' ? (earn.user as { id: number }).id : earn.user } },
        { type: { equals: 'expire' } },
      ]

      if (earn.sourceBooking) {
        conditions.push({
          sourceBooking: {
            equals:
              typeof earn.sourceBooking === 'object'
                ? (earn.sourceBooking as { id: number }).id
                : earn.sourceBooking,
          },
        })
      }

      const { totalDocs } = await req.payload.count({
        collection: 'loyalty-points',
        where: { and: conditions },
      })

      if (totalDocs > 0) continue

      await req.payload.create({
        collection: 'loyalty-points',
        data: {
          user:
            typeof earn.user === 'object' ? (earn.user as { id: number }).id : earn.user,
          type: 'expire',
          amount: -Math.abs(earn.amount),
          sourceBooking:
            typeof earn.sourceBooking === 'object'
              ? (earn.sourceBooking as { id: number }).id
              : (earn.sourceBooking ?? undefined),
          notes: `Expired earn entry from ${String(earn.expiresAt).slice(0, 10)}`,
        },
        overrideAccess: true,
      })

      posted++
    }

    return { output: { posted } }
  },
}

import type { TaskConfig } from 'payload'

const NEW_LISTING_WINDOW_DAYS = 14

export const updateNewListingBadges: TaskConfig<'updateNewListingBadges'> = {
  slug: 'updateNewListingBadges',
  label: 'Update New Listing Badges',
  inputSchema: [],
  outputSchema: [{ name: 'removedFromStale', type: 'number' }],
  schedule: [{ cron: '0 30 3 * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    const cutoff = new Date(Date.now() - NEW_LISTING_WINDOW_DAYS * 86_400_000).toISOString()

    const { docs: staleListings } = await req.payload.find({
      collection: 'properties',
      where: {
        and: [
          { trustBadges: { contains: 'new_listing' } },
          { createdAt: { less_than: cutoff } },
        ],
      },
      limit: 200,
      depth: 0,
    })

    for (const property of staleListings) {
      await req.payload.update({
        collection: 'properties',
        id: property.id,
        data: {
          trustBadges: (property.trustBadges ?? []).filter((b) => b !== 'new_listing'),
        },
        overrideAccess: true,
      })
    }

    return { output: { removedFromStale: staleListings.length } }
  },
}

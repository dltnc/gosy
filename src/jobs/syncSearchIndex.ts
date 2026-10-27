import type { TaskConfig } from 'payload'
import { indexPropertyById } from '../lib/search/indexProperty'

export const syncSearchIndex: TaskConfig<'syncSearchIndex'> = {
  slug: 'syncSearchIndex',
  label: 'Sync Search Index (full resync)',
  inputSchema: [],
  outputSchema: [
    { name: 'indexed', type: 'number' },
    { name: 'failed', type: 'number' },
  ],
  schedule: [{ cron: '0 0 3 * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    let page = 1
    let indexed = 0
    let failed = 0
    const pageSize = 100

    for (;;) {
      const { docs, hasNextPage } = await req.payload.find({
        collection: 'properties',
        where: { status: { equals: 'approved' } },
        limit: pageSize,
        page,
        depth: 0,
        overrideAccess: true,
      })

      for (const property of docs) {
        const ok = await indexPropertyById(req.payload, Number(property.id))
        if (ok) {
          indexed++
        } else {
          failed++
        }
      }

      if (!hasNextPage) break
      page++
    }

    if (failed > 0) {
      req.payload.logger.warn({
        msg: `Search index resync finished with ${failed} failures`,
      })
    }

    return { output: { indexed, failed } }
  },
}

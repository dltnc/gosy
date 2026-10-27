import type { TaskConfig } from 'payload'
import { getSmsDeliveryReport } from '../lib/sms/smsBd.adapter'

const FINAL_STATUSES = ['delivered', 'failed']

export const pollSmsDeliveryStatus: TaskConfig<'pollSmsDeliveryStatus'> = {
  slug: 'pollSmsDeliveryStatus',
  label: 'Poll SMS Delivery Status',
  inputSchema: [],
  outputSchema: [{ name: 'updated', type: 'number' }],
  schedule: [{ cron: '0 */7 * * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    const { docs } = await req.payload.find({
      collection: 'sms-logs',
      where: {
        and: [
          { gatewayRequestId: { exists: true } },
          { deliveryStatus: { not_in: FINAL_STATUSES } },
        ],
      },
      limit: 200,
      depth: 0,
    })

    let updated = 0

    for (const log of docs) {
      const requestId =
        typeof log.gatewayRequestId === 'string' ? log.gatewayRequestId : undefined
      if (!requestId) continue

      const report = await getSmsDeliveryReport(req.payload, requestId)

      if (report.status !== 'unknown') {
        await req.payload.update({
          collection: 'sms-logs',
          id: log.id,
          data: { deliveryStatus: report.status },
          overrideAccess: true,
        })
        updated++
      }
    }

    return { output: { updated } }
  },
}

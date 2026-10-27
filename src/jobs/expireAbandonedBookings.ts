import type { TaskConfig } from 'payload'
import { refundBookingRedemption } from '../lib/loyalty/ledger'

export const expireAbandonedBookings: TaskConfig<'expireAbandonedBookings'> = {
  slug: 'expireAbandonedBookings',
  label: 'Expire Abandoned Bookings',
  inputSchema: [],
  outputSchema: [{ name: 'expired', type: 'number' }],
  schedule: [{ cron: '0 */10 * * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })
    const graceMinutes = settings.bookingHoldGraceMinutes ?? 30
    const cutoff = new Date(Date.now() - graceMinutes * 60 * 1000).toISOString()

    const { docs } = await req.payload.find({
      collection: 'bookings',
      where: {
        and: [
          { status: { equals: 'pending_payment' } },
          { updatedAt: { less_than: cutoff } },
        ],
      },
      limit: 100,
      depth: 0,
    })

    for (const booking of docs) {
      await req.payload.update({
        collection: 'bookings',
        id: booking.id,
        data: { status: 'cancelled_by_guest' },
        overrideAccess: true,
        context: { skipBookingSideEffects: true },
      })

      // The update above deliberately skips booking side effects (no "your stay
      // was cancelled" email for a checkout the guest never completed), so the
      // points credit-back has to be requested explicitly.
      await refundBookingRedemption(req.payload, booking, req)
    }

    return { output: { expired: docs.length } }
  },
}

import type { Metadata } from 'next'

import { CancelBookingButton } from '@/features/dashboard/components/cancel-booking-button'
import { requirePartner } from '@/features/partner/guard'
import { describeRoomItems } from '@/lib/bookings/summary'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Bookings',
}

const STATUS_STYLES: Record<string, string> = {
  pending_payment: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  checked_in: 'bg-blue-100 text-blue-800',
  checked_out: 'bg-slate-100 text-slate-700',
  cancelled_by_guest: 'bg-red-100 text-red-700',
  cancelled_by_partner: 'bg-red-100 text-red-700',
  no_show: 'bg-slate-100 text-slate-500',
}

export default async function PartnerBookingsPage() {
  const { payload, user, isAdmin } = await requirePartner('/partner/bookings')

  const { docs: bookings } = await payload.find({
    collection: 'bookings',
    where: isAdmin ? {} : { 'property.partner': { equals: user.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 2,
    overrideAccess: false,
    user,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          All reservations across your properties. Guests can cancel pending/confirmed stays;
          contact the platform for exceptions.
        </p>
      </header>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No bookings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Once your listing is live, reservations will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const property = typeof booking.property === 'object' ? booking.property : null
            // "2 × Deluxe Room" for a multi-room stay; the mirror covers pre-line-item bookings.
            const rooms =
              describeRoomItems(booking.items) ||
              (typeof booking.roomType === 'object' && booking.roomType
                ? booking.roomType.name
                : '')
            const guest = typeof booking.guest === 'object' ? booking.guest : null
            const partnerCanCancel =
              booking.status === 'pending_payment' || booking.status === 'confirmed'

            return (
              <Card key={booking.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{property?.name ?? 'Property'}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {booking.bookingRef}
                      </span>
                      <Badge
                        variant="outline"
                        className={`capitalize ${STATUS_STYLES[booking.status ?? ''] ?? ''}`}
                      >
                        {booking.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {guest?.name ?? 'Guest'} · {rooms || 'Room'} ·{' '}
                      {new Date(booking.checkInDate).toLocaleDateString('en-GB')} →{' '}
                      {new Date(booking.checkOutDate).toLocaleDateString('en-GB')}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <span className="text-lg font-bold">
                      {booking.currency ?? 'BDT'}{' '}
                      {(booking.pricing?.totalAmount ?? 0).toLocaleString('en-US')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Payout {booking.currency ?? 'BDT'}{' '}
                      {(booking.pricing?.partnerPayoutAmount ?? 0).toLocaleString('en-US')}
                    </span>
                    {partnerCanCancel ? (
                      <CancelBookingButton bookingId={Number(booking.id)} guestOnly={false} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

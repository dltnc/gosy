import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'

import { CancelBookingButton } from '@/features/dashboard/components/cancel-booking-button'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { BOOKING_ACTIVE_STATUSES } from '@/lib/bookings/statuses'
import { describeRoomItems } from '@/lib/bookings/summary'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'My bookings',
}

interface BookingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
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

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const query = await searchParams
  const tab = (Array.isArray(query.tab) ? query.tab[0] : query.tab) ?? 'upcoming'
  const showPast = tab === 'past'

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const { docs: bookings } = await payload.find({
    collection: 'bookings',
    where: {
      and: [
        { guest: { equals: user!.id } },
        showPast
          ? {
              status: {
                in: ['checked_out', 'cancelled_by_guest', 'cancelled_by_partner', 'no_show'],
              },
            }
          : { status: { in: [...BOOKING_ACTIVE_STATUSES] } },
      ],
    },
    sort: showPast ? '-checkInDate' : 'checkInDate',
    limit: 50,
    depth: 1,
    overrideAccess: false,
    user,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">My bookings</h1>
        <p className="text-sm text-muted-foreground">
          Manage upcoming stays and review your history.
        </p>
      </header>

      <div className="flex gap-2">
        <TabLink href="/dashboard/bookings" active={!showPast} label="Upcoming" />
        <TabLink href="/dashboard/bookings?tab=past" active={showPast} label="History" />
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">
            {showPast ? 'No past bookings yet.' : 'No upcoming bookings.'}
          </p>
          {!showPast ? (
            <Link href="/" className="mt-1 inline-block text-sm underline underline-offset-4">
              Find your next stay
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const property = typeof booking.property === 'object' ? booking.property : null
            // One row per room, so this reads "2 × Deluxe Room" for a multi-room stay; the mirror is a
            // fallback for bookings written before rooms became line items.
            const rooms =
              describeRoomItems(booking.items) ||
              (typeof booking.roomType === 'object' && booking.roomType
                ? booking.roomType.name
                : '')
            const cancellable = (BOOKING_ACTIVE_STATUSES as string[]).includes(booking.status ?? '')

            return (
              <Card key={booking.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/bookings/${booking.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {property?.name ?? 'Stay'}
                      </Link>
                      <Badge
                        variant="outline"
                        className={`capitalize ${STATUS_STYLES[booking.status ?? ''] ?? ''}`}
                      >
                        {booking.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rooms ? `${rooms} · ` : ''}
                      {new Date(booking.checkInDate).toLocaleDateString('en-GB')} →{' '}
                      {new Date(booking.checkOutDate).toLocaleDateString('en-GB')} · Ref{' '}
                      <span className="font-mono">{booking.bookingRef}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                    <span className="text-lg font-bold">
                      {booking.currency ?? 'BDT'}{' '}
                      {Math.round(booking.pricing?.totalAmount ?? 0).toLocaleString('en-US')}
                    </span>
                    {cancellable && !showPast ? (
                      <CancelBookingButton bookingId={Number(booking.id)} />
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

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground'
          : 'rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground'
      }
    >
      {label}
    </Link>
  )
}

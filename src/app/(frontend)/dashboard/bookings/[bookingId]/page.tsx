import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import { notFound } from 'next/navigation'
import { FileDown } from 'lucide-react'

import { CancelBookingButton } from '@/features/dashboard/components/cancel-booking-button'
import { ReviewForm } from '@/features/reviews/components/review-form'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { BOOKING_ACTIVE_STATUSES } from '@/lib/bookings/statuses'
import { countRooms, describeRoomItems, groupRoomItems } from '@/lib/bookings/summary'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'Booking details',
}

interface BookingDetailPageProps {
  params: Promise<{ bookingId: string }>
}

function money(amount: number | null | undefined, currency: string): string {
  return `${currency} ${Math.round(amount ?? 0).toLocaleString('en-US')}`
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { bookingId } = await params

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  let booking
  try {
    booking = await payload.findByID({
      collection: 'bookings',
      id: Number(bookingId),
      depth: 2,
      overrideAccess: false,
      user,
    })
  } catch {
    return notFound()
  }

  if (
    !booking ||
    (typeof booking.guest === 'object' ? booking.guest?.id : booking.guest) !== user!.id
  ) {
    notFound()
  }

  const property = typeof booking.property === 'object' ? booking.property : null
  // Rooms are line items; the `roomType` mirror only answers for bookings written before that change.
  const roomGroups = groupRoomItems(booking.items)
  const roomLabel =
    describeRoomItems(booking.items) ||
    (typeof booking.roomType === 'object' && booking.roomType ? booking.roomType.name : '') ||
    '—'
  const roomCount = countRooms(booking.items)
  const currency = booking.currency ?? 'BDT'
  const pricing = booking.pricing

  const invoice =
    typeof booking.invoicePdf === 'object' && booking.invoicePdf !== null
      ? booking.invoicePdf
      : null

  const cancellable = (BOOKING_ACTIVE_STATUSES as string[]).includes(booking.status ?? '')

  const existingReview =
    booking.status === 'checked_out'
      ? await payload.count({
          collection: 'reviews',
          where: { booking: { equals: booking.id } },
        })
      : null

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/dashboard/bookings"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← All bookings
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{property?.name ?? 'Booking'}</h1>
            <p className="font-mono text-sm text-muted-foreground">{booking.bookingRef}</p>
          </div>
          <Badge variant="outline" className="capitalize">
            {booking.status?.replace(/_/g, ' ')}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Itinerary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <Field
                label={roomCount > 1 ? `Rooms (${roomCount})` : 'Room type'}
                value={roomLabel}
              />
              <Field
                label="Guests"
                value={`${booking.adults ?? 2} adult${(booking.adults ?? 2) === 1 ? '' : 's'}${booking.children ? `, ${booking.children} children` : ''}`}
              />
              <Field
                label="Check-in"
                value={new Date(booking.checkInDate).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              />
              <Field
                label="Check-out"
                value={new Date(booking.checkOutDate).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              />
              {property?.address ? (
                <Field
                  label="Address"
                  value={[
                    property.address.streetAddress,
                    property.address.area,
                    property.address.city,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                />
              ) : null}
              {property?.contact?.phone ? (
                <Field label="Property phone" value={property.contact.phone} />
              ) : null}
              {property?.policies?.checkInTime ? (
                <Field
                  label="Check-in / out time"
                  value={`from ${property.policies.checkInTime}, until ${property.policies.checkOutTime ?? '12:00'}`}
                />
              ) : null}
              {booking.specialRequests ? (
                <Field label="Special requests" value={booking.specialRequests} />
              ) : null}
            </CardContent>
          </Card>

          {roomGroups.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {roomCount > 1 ? `Your ${roomCount} rooms` : 'Your room'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {roomGroups.map((group) => (
                  <div
                    key={`${group.name}-${group.nightlyRate ?? ''}`}
                    className="flex items-start justify-between gap-4"
                  >
                    <span>
                      <span className="font-medium">
                        {group.quantity > 1 ? `${group.quantity} × ` : ''}
                        {group.name}
                      </span>
                      {group.roomNumbers.length > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          Room {group.roomNumbers.join(', ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-right">
                      {group.nightlyRate != null ? (
                        <span className="block">{money(group.nightlyRate, currency)} / night</span>
                      ) : null}
                      {group.subtotal != null ? (
                        <span className="block text-xs text-muted-foreground">
                          {money(group.subtotal, currency)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {property?.policies?.cancellationPolicy ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cancellation policy</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {property.policies.cancellationPolicy}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row
                label={`${roomCount > 1 ? `${roomCount} rooms` : 'Room'} (${pricing?.nights ?? 0} night${(pricing?.nights ?? 0) === 1 ? '' : 's'})`}
                value={money(pricing?.subtotal, currency)}
              />
              {(pricing?.couponDiscountAmount ?? 0) > 0 ? (
                <Row
                  label="Coupon discount"
                  value={`−${money(pricing?.couponDiscountAmount, currency)}`}
                  accent
                />
              ) : null}
              {(pricing?.pointsDiscountAmount ?? 0) > 0 ? (
                <Row
                  label="Points redeemed"
                  value={`−${money(pricing?.pointsDiscountAmount, currency)}`}
                  accent
                />
              ) : null}
              {(booking.pointsRedeemed ?? 0) > 0 ? (
                <Row label="Points used" value={booking.pointsRedeemed!.toLocaleString('en-US')} />
              ) : null}
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="font-medium">Total</span>
                <span className="text-xl font-bold">{money(pricing?.totalAmount, currency)}</span>
              </div>

              {invoice?.url ? (
                <Button asChild variant="outline" className="w-full">
                  <a href={invoice.url!} download target="_blank" rel="noopener noreferrer">
                    <FileDown className="size-4" /> Download invoice (PDF)
                  </a>
                </Button>
              ) : null}

              {cancellable ? (
                <div className="pt-2">
                  <CancelBookingButton bookingId={Number(booking.id)} />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {booking.status === 'checked_out' && existingReview && existingReview.totalDocs === 0 ? (
            <ReviewForm bookingId={Number(booking.id)} />
          ) : null}

          {booking.status === 'checked_out' && existingReview && existingReview.totalDocs > 0 ? (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                You reviewed this stay — thanks for the feedback!
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? 'text-green-600' : ''}>{value}</span>
    </div>
  )
}

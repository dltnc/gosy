import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { countRooms, describeRoomItems } from '@/lib/bookings/summary'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'Booking confirmed',
}

interface ConfirmedPageProps {
  params: Promise<{ ref: string }>
}

function money(amount: number | null | undefined, currency: string): string {
  return `${currency} ${Math.round(amount ?? 0).toLocaleString('en-US')}`
}

export default async function ConfirmedPage({ params }: ConfirmedPageProps) {
  const { ref } = await params

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/booking/${ref}/confirmed`)}`)

  const { docs } = await payload.find({
    collection: 'bookings',
    where: { bookingRef: { equals: decodeURIComponent(ref) } },
    limit: 1,
    depth: 2,
    overrideAccess: false,
    user,
  })

  const booking = docs[0]
  if (!booking) notFound()

  const property = typeof booking.property === 'object' ? booking.property : null
  // The confirmation has to name every room booked, not just the first line item.
  const roomCount = countRooms(booking.items)
  const roomLabel =
    describeRoomItems(booking.items) ||
    (typeof booking.roomType === 'object' && booking.roomType ? booking.roomType.name : '') ||
    '—'
  const pricing = booking.pricing

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="size-12 text-green-600" />
        <h1 className="text-2xl font-bold">Your stay is confirmed</h1>
        <p className="text-sm text-muted-foreground">
          A confirmation email is on its way. Show your booking reference at the front desk.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base">{booking.bookingRef}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Property" value={property?.name ?? '—'} />
          <Row label="City" value={property?.address?.city ?? '—'} />
          <Row label={roomCount > 1 ? `Rooms (${roomCount})` : 'Room'} value={roomLabel} />
          <Row label="Check-in" value={new Date(booking.checkInDate).toLocaleDateString('en-GB')} />
          <Row
            label="Check-out"
            value={new Date(booking.checkOutDate).toLocaleDateString('en-GB')}
          />
          <Separator />
          <Row label="Subtotal" value={money(pricing?.subtotal, booking.currency ?? 'BDT')} />
          {(pricing?.couponDiscountAmount ?? 0) > 0 ? (
            <Row
              label="Coupon discount"
              value={`−${money(pricing?.couponDiscountAmount, booking.currency ?? 'BDT')}`}
            />
          ) : null}
          {(pricing?.pointsDiscountAmount ?? 0) > 0 ? (
            <Row
              label="Points redeemed"
              value={`−${money(pricing?.pointsDiscountAmount, booking.currency ?? 'BDT')}`}
            />
          ) : null}
          <Separator />
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Total paid</span>
            <span className="text-xl font-bold">
              {money(pricing?.totalAmount, booking.currency ?? 'BDT')}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-3">
        <Button asChild>
          <Link href={`/dashboard/bookings/${booking.id}`}>View in my bookings</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Explore more stays</Link>
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

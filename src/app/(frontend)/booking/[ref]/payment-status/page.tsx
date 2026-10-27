import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import { notFound, redirect } from 'next/navigation'

import { PaymentStatusClient } from '@/features/booking-checkout/components/payment-status-client'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { encodeRoomSelection } from '@/lib/bookings/constants'
import { roomSelectionFromItems } from '@/lib/bookings/summary'

export const metadata: Metadata = {
  title: 'Payment status',
}

interface PaymentStatusPageProps {
  params: Promise<{ ref: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function isoDay(value: string): string {
  return new Date(value).toISOString().slice(0, 10)
}

export default async function PaymentStatusPage({ params, searchParams }: PaymentStatusPageProps) {
  const [{ ref }, query] = await Promise.all([params, searchParams])

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/booking/${ref}/payment-status`)}`)

  const { docs } = await payload.find({
    collection: 'bookings',
    where: { bookingRef: { equals: decodeURIComponent(ref) } },
    limit: 1,
    depth: 1,
    overrideAccess: false,
    user,
  })

  const booking = docs[0]
  if (!booking) notFound()

  const { docs: payments } = await payload.find({
    collection: 'payments',
    where: { booking: { equals: booking.id } },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const payment = payments[0] ?? null

  if (booking.status === 'confirmed') {
    redirect(`/booking/${ref}/confirmed`)
  }

  const callbackData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(query)) {
    const single = Array.isArray(value) ? value[0] : value
    if (single != null) callbackData[key] = single
  }

  // Retrying has to re-offer the whole stay, so the link carries every room the guest picked. The
  // `roomType` mirror only answers for bookings written before rooms became line items.
  const selection = roomSelectionFromItems(booking.items)
  if (selection.size === 0) {
    const mirrored = Number(
      typeof booking.roomType === 'object' && booking.roomType !== null
        ? booking.roomType.id
        : booking.roomType,
    )
    if (Number.isInteger(mirrored) && mirrored > 0) selection.set(mirrored, 1)
  }

  const retryHref =
    selection.size > 0
      ? `/book?${new URLSearchParams({
          rooms: encodeRoomSelection(selection),
          checkIn: isoDay(booking.checkInDate),
          checkOut: isoDay(booking.checkOutDate),
          adults: String(booking.adults ?? 2),
          children: String(booking.children ?? 0),
        }).toString()}`
      : '/'

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PaymentStatusClient
        bookingRef={booking.bookingRef ?? String(booking.id)}
        bookingId={Number(booking.id)}
        retryHref={retryHref}
        paymentId={payment ? Number(payment.id) : null}
        gateway={payment?.gateway ?? 'bank_transfer'}
        initialPaymentStatus={payment?.status ?? 'pending'}
        callbackData={callbackData}
      />
    </div>
  )
}

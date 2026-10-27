import { renderToBuffer } from '@react-pdf/renderer'
import type { Payload } from 'payload'
import type { Booking } from '../../payload-types'
import { groupRoomItems } from '../bookings/summary'
import { InvoiceDocument, type InvoiceData, type InvoiceRoomLine } from './InvoiceDocument'

export interface GeneratedInvoice {
  buffer: Buffer
  invoiceNumber: string
}

export async function generateInvoicePdf(
  payload: Payload,
  bookingId: string | number,
): Promise<GeneratedInvoice> {
  const booking = (await payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 2,
    overrideAccess: true,
  })) as Booking

  const guest = typeof booking.guest === 'object' ? booking.guest : null
  const property = typeof booking.property === 'object' ? booking.property : null
  const roomType = typeof booking.roomType === 'object' ? booking.roomType : null

  const { docs: successPayments } = await payload.find({
    collection: 'payments',
    where: {
      and: [{ booking: { equals: booking.id } }, { status: { equals: 'success' } }],
    },
    sort: '-createdAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const payment = successPayments[0]

  const settings = await payload.findGlobal({ slug: 'platform-settings', depth: 0 })

  const invoiceNumber = `INV-${booking.bookingRef ?? booking.id}`
  const currency = booking.currency ?? settings.currency ?? 'BDT'
  const pricing = booking.pricing ?? {}

  // An invoice itemises what was charged: one line per room type and rate, with the frozen rates from
  // the booking's own rows. The `roomType` mirror only carries bookings written before that change, and
  // for those the whole stay is a single unpriced line against the recorded subtotal.
  const grouped = groupRoomItems(booking.items)
  const rooms: InvoiceRoomLine[] =
    grouped.length > 0
      ? grouped
      : [
          {
            name: roomType?.name ?? '—',
            quantity: 1,
            nightlyRate: null,
            subtotal: pricing.subtotal ?? null,
          },
        ]

  const data: InvoiceData = {
    invoiceNumber,
    issuedAt: new Date().toISOString(),
    platformName: settings.platformName || 'Hotel Booking Platform',
    currency,
    bookingRef: booking.bookingRef ?? String(booking.id),
    guestName: guest?.name ?? 'Guest',
    guestEmail: guest?.email,
    propertyName: property?.name ?? '—',
    propertyCity: property?.address?.city ?? '',
    rooms,
    checkInDate: booking.checkInDate,
    checkOutDate: booking.checkOutDate,
    nights: pricing.nights ?? 0,
    subtotal: pricing.subtotal ?? 0,
    couponDiscountAmount: pricing.couponDiscountAmount ?? 0,
    pointsDiscountAmount: pricing.pointsDiscountAmount ?? 0,
    totalAmount: pricing.totalAmount ?? 0,
    paymentGateway:
      payment?.gateway?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? '—',
    paymentTransactionId: payment?.transactionId ?? undefined,
  }

  const buffer = await renderToBuffer(InvoiceDocument({ data }))

  return { buffer: Buffer.from(buffer), invoiceNumber }
}

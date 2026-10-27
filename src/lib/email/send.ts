import type { Payload } from 'payload'
import type { RoomItemLike } from '../bookings/summary'
import { countRooms, describeRoomItems } from '../bookings/summary'
import { isEmailConfigured } from '../settings/integrations'
import { sendTemplatedEmail } from './render'
import { BookingCancelledEmail } from './templates/BookingCancelledEmail'
import { BookingConfirmationEmail } from './templates/BookingConfirmationEmail'
import { PartnerNewBookingEmail } from './templates/PartnerNewBookingEmail'
import { PaymentReceiptEmail } from './templates/PaymentReceiptEmail'
import { PropertyApprovedEmail } from './templates/PropertyApprovedEmail'
import { PropertyRejectedEmail } from './templates/PropertyRejectedEmail'
import { SubscriptionActivatedEmail } from './templates/SubscriptionActivatedEmail'
import { AdminAlertEmail } from './templates/AdminAlertEmail'

interface PopulatedBooking {
  id?: number
  bookingRef?: string | null
  guest: { name?: string | null; email?: string | null; phone?: string | null } | number | null
  property:
    | {
        name?: string | null
        partner?: { name?: string | null; email?: string | null } | number | null
      }
    | number
    | null
  /** Mirror of `items[0]`, kept for older rows; prefer `items` when describing the stay. */
  roomType?: ({ name?: string | null } | number | null) | undefined
  items?: RoomItemLike[] | null
  adults?: number | null
  children?: number | null
  checkInDate: string
  checkOutDate: string
  pricing?: {
    totalAmount?: number | null
    partnerPayoutAmount?: number | null
  } | null
  currency?: string | null
}

function baseUrl(): string {
  return process.env.APP_URL || 'http://localhost:3000'
}

function guestDashboardUrl(): string {
  return `${baseUrl()}/dashboard/bookings`
}

function partnerDashboardUrl(): string {
  return process.env.PARTNER_APP_URL || `${baseUrl()}`
}

async function loadPopulatedBooking(
  payload: Payload,
  bookingId: string | number,
): Promise<PopulatedBooking> {
  return payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 2,
    overrideAccess: true,
  })
}

export async function sendBookingConfirmationEmail(
  payload: Payload,
  bookingInput: unknown,
): Promise<void> {
  await sendGuestBookingEmail(payload, bookingInput, 'confirmation')
}

async function sendGuestBookingEmail(
  payload: Payload,
  bookingInput: unknown,
  kind: 'confirmation' | 'cancellation',
): Promise<void> {
  if (!(await isEmailConfigured(payload))) return

  const booking = bookingInput as PopulatedBooking

  if (!booking?.guest || typeof booking.guest === 'number') return
  if (!booking.guest.email) return

  const property =
    typeof booking.property === 'object' && booking.property !== null ? booking.property : null
  // Multi-room bookings read as "2 × Deluxe Room, Suite". The `roomType` mirror is only a fallback for
  // bookings written before rooms became line items.
  const roomSummary = describeRoomItems(booking.items) || legacyRoomTypeName(booking)

  try {
    await sendTemplatedEmail(payload, {
      to: booking.guest.email,
      subject:
        kind === 'confirmation'
          ? `Booking confirmed — ${booking.bookingRef ?? ''}`
          : `Booking cancelled — ${booking.bookingRef ?? ''}`,
      element:
        kind === 'confirmation'
          ? BookingConfirmationEmail({
              guestName: booking.guest.name ?? undefined,
              bookingRef: booking.bookingRef ?? undefined,
              propertyName: property?.name ?? undefined,
              roomSummary: roomSummary || undefined,
              roomCount: countRooms(booking.items) || undefined,
              checkInDate: booking.checkInDate,
              checkOutDate: booking.checkOutDate,
              totalAmount: booking.pricing?.totalAmount ?? undefined,
              currency: booking.currency ?? 'BDT',
              dashboardUrl: guestDashboardUrl(),
            })
          : BookingCancelledEmail({
              guestName: booking.guest.name ?? undefined,
              bookingRef: booking.bookingRef ?? undefined,
              propertyName: property?.name ?? undefined,
              checkInDate: booking.checkInDate,
              checkOutDate: booking.checkOutDate,
              dashboardUrl: guestDashboardUrl(),
            }),
      template: kind === 'confirmation' ? 'BookingConfirmationEmail' : 'BookingCancelledEmail',
      relatedBooking: parseId(booking.id),
    })
  } catch (err) {
    payload.logger.error({
      msg: `Booking ${kind} email failed`,
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }
}

function parseId(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return undefined
}

function legacyRoomTypeName(booking: PopulatedBooking): string {
  const roomType = booking.roomType
  return roomType && typeof roomType === 'object' ? roomType.name?.trim() || '' : ''
}

export async function sendBookingCancelledEmail(
  payload: Payload,
  bookingInput: PopulatedBooking & { id?: number },
): Promise<void> {
  await sendGuestBookingEmail(payload, bookingInput, 'cancellation')
}

export async function sendPartnerNewBookingEmail(
  payload: Payload,
  bookingInput: PopulatedBooking & { id?: number },
): Promise<void> {
  if (!(await isEmailConfigured(payload))) return

  const booking = bookingInput
  const property =
    typeof booking.property === 'object' && booking.property !== null ? booking.property : null
  const partner = property && typeof property.partner === 'object' ? property.partner : null

  if (!partner?.email) return

  const roomSummary = describeRoomItems(booking.items) || legacyRoomTypeName(booking)
  const guest = typeof booking.guest === 'object' && booking.guest !== null ? booking.guest : null

  try {
    await sendTemplatedEmail(payload, {
      to: partner.email,
      subject: `New booking at ${property?.name ?? 'your property'} — ${booking.bookingRef ?? ''}`,
      element: PartnerNewBookingEmail({
        partnerName: partner.name ?? undefined,
        bookingRef: booking.bookingRef ?? undefined,
        guestName: guest?.name ?? undefined,
        propertyName: property?.name ?? undefined,
        roomSummary: roomSummary || undefined,
        roomCount: countRooms(booking.items) || undefined,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
        adults: booking.adults ?? undefined,
        children: booking.children ?? undefined,
        currency: booking.currency ?? 'BDT',
        partnerPayoutAmount: booking.pricing?.partnerPayoutAmount ?? undefined,
      }),
      template: 'PartnerNewBookingEmail',
      ...(typeof booking.id === 'number' ? { relatedBooking: booking.id } : {}),
    })
  } catch (err) {
    payload.logger.error({
      msg: 'Partner new-booking email failed',
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }
}

export async function sendPaymentReceiptEmail(
  payload: Payload,
  bookingId: string | number,
  attachment?: { filename: string; content: Buffer; contentType?: string },
): Promise<string | null> {
  if (!(await isEmailConfigured(payload))) return null

  const booking = (await loadPopulatedBooking(payload, bookingId)) as PopulatedBooking & {
    id?: number
  }

  if (!booking.guest || typeof booking.guest === 'number') return null
  if (!booking.guest.email) return null

  const property =
    typeof booking.property === 'object' && booking.property !== null ? booking.property : null

  let gateway: string | undefined
  let transactionId: string | undefined
  if (typeof booking.id === 'number') {
    const { docs } = await payload.find({
      collection: 'payments',
      where: {
        and: [{ booking: { equals: booking.id } }, { status: { equals: 'success' } }],
      },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    gateway = docs[0]?.gateway?.replace(/_/g, ' ')
    transactionId = docs[0]?.transactionId ?? undefined
  }

  try {
    await sendTemplatedEmail(payload, {
      to: booking.guest.email,
      subject: `Payment received — ${booking.bookingRef ?? ''}`,
      element: PaymentReceiptEmail({
        guestName: booking.guest.name ?? undefined,
        bookingRef: booking.bookingRef ?? undefined,
        propertyName: property?.name ?? undefined,
        amount: booking.pricing?.totalAmount ?? undefined,
        currency: booking.currency ?? 'BDT',
        gateway,
        transactionId,
        invoiceNote: attachment ? 'Your invoice is attached to this email as a PDF.' : undefined,
        dashboardUrl: guestDashboardUrl(),
      }),
      template: 'PaymentReceiptEmail',
      ...(typeof booking.id === 'number' ? { relatedBooking: booking.id } : {}),
      attachments: attachment ? [attachment] : undefined,
    })
    return booking.guest.email
  } catch (err) {
    payload.logger.error({
      msg: 'Payment receipt email failed',
      err: err instanceof Error ? err : new Error(String(err)),
    })
    return null
  }
}

export async function sendPropertyDecisionEmail(
  payload: Payload,
  propertyRef: { id: number; name?: string; status?: string | null },
  decision: 'approved' | 'rejected',
): Promise<void> {
  if (!(await isEmailConfigured(payload))) return

  const property = await payload.findByID({
    collection: 'properties',
    id: propertyRef.id,
    depth: 1,
    overrideAccess: true,
    select: { name: true, partner: true },
  })

  const partner = typeof property.partner === 'object' ? property.partner : null
  if (!partner?.email) return

  try {
    await sendTemplatedEmail(payload, {
      to: partner.email,
      subject:
        decision === 'approved'
          ? `${property.name} is now live`
          : `Update on your listing: ${property.name}`,
      element:
        decision === 'approved'
          ? PropertyApprovedEmail({
              partnerName: partner.name ?? undefined,
              propertyName: property.name,
              dashboardUrl: partnerDashboardUrl(),
            })
          : PropertyRejectedEmail({
              partnerName: partner.name ?? undefined,
              propertyName: property.name,
              dashboardUrl: partnerDashboardUrl(),
            }),
      template: decision === 'approved' ? 'PropertyApprovedEmail' : 'PropertyRejectedEmail',
    })
  } catch (err) {
    payload.logger.error({
      msg: `Property ${decision} email failed`,
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }
}

export async function sendSubscriptionActivatedEmail(
  payload: Payload,
  subscriptionId: string | number,
): Promise<void> {
  if (!(await isEmailConfigured(payload))) return

  const subscription = await payload.findByID({
    collection: 'property-subscriptions',
    id: subscriptionId,
    depth: 2,
    overrideAccess: true,
  })

  const property = typeof subscription.property === 'object' ? subscription.property : null
  const plan = typeof subscription.plan === 'object' ? subscription.plan : null
  const partner = property && typeof property.partner === 'object' ? property.partner : null

  if (!partner?.email) return

  try {
    await sendTemplatedEmail(payload, {
      to: partner.email,
      subject: `${plan?.name ?? 'Subscription'} activated for ${property?.name ?? 'your property'}`,
      element: SubscriptionActivatedEmail({
        partnerName: partner.name ?? undefined,
        propertyName: property?.name ?? undefined,
        planName: plan?.name ?? undefined,
        badgeText: plan?.benefits?.badgeText ?? undefined,
        startDate: subscription.startDate ?? undefined,
        endDate: subscription.endDate ?? undefined,
        dashboardUrl: partnerDashboardUrl(),
      }),
      template: 'SubscriptionActivatedEmail',
    })
  } catch (err) {
    payload.logger.error({
      msg: 'Subscription activated email failed',
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }
}

export async function sendAdminAlertEmail(
  payload: Payload,
  alert: { alertTitle: string; message: string; details?: string },
): Promise<void> {
  if (!(await isEmailConfigured(payload))) return

  const { docs: admins } = await payload.find({
    collection: 'users',
    where: { role: { equals: 'admin' } },
    limit: 5,
    depth: 0,
    overrideAccess: true,
    select: { email: true },
  })

  const adminPanelUrl = process.env.ADMIN_APP_URL || `${baseUrl()}/admin`

  for (const admin of admins) {
    if (!admin.email) continue
    try {
      await sendTemplatedEmail(payload, {
        to: admin.email,
        subject: `[Alert] ${alert.alertTitle}`,
        element: AdminAlertEmail({
          alertTitle: alert.alertTitle,
          message: alert.message,
          details: alert.details,
          adminDashboardUrl: adminPanelUrl,
        }),
        template: 'AdminAlertEmail',
      })
    } catch (err) {
      payload.logger.error({
        msg: `Admin alert email failed (${admin.email})`,
        err: err instanceof Error ? err : new Error(String(err)),
      })
    }
  }
}

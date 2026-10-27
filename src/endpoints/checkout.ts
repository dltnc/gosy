import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'
import { allocateRooms, normalizeRequestedItems } from '../lib/bookings/lineItems'
import { getPaymentGateway, type GatewaySlug } from '../lib/payments'
import { isGatewayEnabled } from '../lib/payments/config'
import { getPaymentUrls } from '../lib/payments/urls'

const API_GATEWAYS: GatewaySlug[] = ['bkash', 'nagad', 'sslcommerz', 'aamarpay']

interface CheckoutBody {
  /** Preferred shape: one entry per room type, with how many of it the guest wants. */
  items?: { roomTypeId?: number | string; quantity?: number }[]
  /** Single-room shorthand kept for older clients and deep links. */
  roomTypeId?: number | string
  roomId?: number | string
  checkInDate?: string
  checkOutDate?: string
  adults?: number
  children?: number
  guestPhone?: string
  specialRequests?: string
  pointsRedeemed?: number
  couponCode?: string
  gateway?: string
}

/**
 * Turn whatever the client sent into `[{ roomTypeId, quantity }]`.
 *
 * `roomId` is accepted but only to look up its room type — the server picks the concrete rooms, so a
 * client cannot pin a room another guest is mid-checkout on, and cannot ask for a room whose type it
 * misreported.
 */
async function requestedItems(
  req: Parameters<NonNullable<Endpoint['handler']>>[0],
  body: CheckoutBody,
) {
  const items = normalizeRequestedItems(body.items)
  if (items.length > 0) return items

  if (body.roomTypeId != null && body.roomTypeId !== '') {
    return normalizeRequestedItems([{ roomTypeId: body.roomTypeId, quantity: 1 }])
  }

  if (body.roomId != null && body.roomId !== '') {
    const room = await req.payload.findByID({
      collection: 'rooms',
      id: body.roomId,
      depth: 0,
      overrideAccess: true,
      select: { roomType: true },
    })
    const roomTypeId = typeof room.roomType === 'object' ? room.roomType?.id : room.roomType
    if (roomTypeId != null) {
      return normalizeRequestedItems([{ roomTypeId, quantity: 1 }])
    }
  }

  return []
}

export const checkoutEndpoint: Endpoint = {
  path: '/checkout',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('You must be logged in to book.', 401)

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as CheckoutBody

    if (!body.checkInDate || !body.checkOutDate) {
      throw new APIError('checkInDate and checkOutDate are required.', 400)
    }

    const items = await requestedItems(req, body)
    if (items.length === 0) {
      throw new APIError('Select at least one room to book.', 400)
    }

    const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })

    let couponApplied: number | undefined
    if (body.couponCode) {
      const code = body.couponCode.trim().toUpperCase()
      const { docs } = await req.payload.find({
        collection: 'coupons',
        where: { code: { equals: code } },
        limit: 1,
        depth: 0,
      })
      if (!docs[0]) throw new APIError(`Coupon "${code}" does not exist.`, 400)
      couponApplied = docs[0].id as number
    }

    // Allocation is the point where "2 Deluxe rooms" becomes two specific room ids, and where a
    // sold-out request fails with a message naming the room type rather than a generic conflict.
    const allocation = await allocateRooms(req.payload, {
      items,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
    })

    const booking = await req.payload.create({
      collection: 'bookings',
      data: {
        guest: req.user.id,
        // `property` is re-derived from the rooms in `beforeValidate`; it is sent here only because the
        // field is required, and allocation already knows which property the rooms belong to.
        property: allocation.propertyId,
        items: allocation.items,
        checkInDate: body.checkInDate,
        checkOutDate: body.checkOutDate,
        adults: body.adults ?? 2,
        children: body.children ?? 0,
        pointsRedeemed: body.pointsRedeemed ?? 0,
        ...(body.guestPhone ? { guestPhone: body.guestPhone.trim() } : {}),
        ...(couponApplied ? { couponApplied } : {}),
        ...(body.specialRequests ? { specialRequests: body.specialRequests } : {}),
      },
      overrideAccess: true,
      draft: false,
    })

    const gatewaySlug = body.gateway ?? 'bank_transfer'
    const totalAmount = booking.pricing?.totalAmount ?? 0

    if (!API_GATEWAYS.includes(gatewaySlug as GatewaySlug)) {
      return Response.json({
        booking,
        payment: null,
        redirectUrl: null,
        message:
          gatewaySlug === 'bank_transfer'
            ? 'Booking created. Submit your transfer reference next.'
            : 'Booking created awaiting manual confirmation.',
      })
    }

    if (!isGatewayEnabled(settings, gatewaySlug as GatewaySlug)) {
      throw new APIError(`Payment gateway "${gatewaySlug}" is not available.`, 400)
    }

    const urls = getPaymentUrls(booking.id, booking.bookingRef ?? undefined)

    const payment = await req.payload.create({
      collection: 'payments',
      data: {
        purpose: 'booking_payment',
        gateway: gatewaySlug as GatewaySlug,
        status: 'initiated',
        amount: totalAmount,
        currency: booking.currency ?? settings.currency ?? 'BDT',
        booking: booking.id,
      },
      overrideAccess: true,
      context: { skipPaymentCascade: true },
      draft: false,
    })

    const gateway = getPaymentGateway(gatewaySlug as GatewaySlug)
    const guest = typeof booking.guest === 'object' ? booking.guest : null

    const result = await gateway.initiate({
      payload: req.payload,
      paymentId: payment.id,
      amount: totalAmount,
      currency: payment.currency ?? 'BDT',
      customer: {
        name: guest?.name ?? undefined,
        email: guest?.email ?? undefined,
        phone: guest?.phone ?? undefined,
      },
      ...urls,
    })

    const updatedPayment = await req.payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        gatewayRequestId: result.gatewayRequestId ?? undefined,
        gatewayMetadata: { initiate: result.raw },
      },
      overrideAccess: true,
      context: { skipPaymentCascade: true },
    })

    return Response.json({
      booking,
      payment: updatedPayment,
      redirectUrl: result.redirectUrl,
    })
  },
}

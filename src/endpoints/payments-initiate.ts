import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'
import { getPaymentGateway, type GatewaySlug } from '../lib/payments'
import { isGatewayEnabled } from '../lib/payments/config'
import { getPaymentUrls } from '../lib/payments/urls'

const API_GATEWAYS: GatewaySlug[] = ['bkash', 'nagad', 'sslcommerz', 'aamarpay']

interface InitiateBody {
  paymentId?: number
  gateway?: string
}

export const paymentsInitiateEndpoint: Endpoint = {
  path: '/initiate',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('Authentication required.', 401)

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as InitiateBody
    if (!body.paymentId) throw new APIError('paymentId is required.', 400)
    if (!body.gateway || !API_GATEWAYS.includes(body.gateway as GatewaySlug)) {
      throw new APIError('A valid API-based gateway is required.', 400)
    }

    const payment = await req.payload.findByID({
      collection: 'payments',
      id: body.paymentId,
      depth: 1,
      overrideAccess: false,
      user: req.user,
    })

    if (['success', 'refunded'].includes(payment.status)) {
      throw new APIError(`This payment is already ${payment.status}.`, 400)
    }

    const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })
    if (!isGatewayEnabled(settings, body.gateway as GatewaySlug)) {
      throw new APIError(`Payment gateway "${body.gateway}" is not available.`, 400)
    }

    let bookingRef: string | undefined
    let guestName: string | undefined
    let guestEmail: string | undefined
    let guestPhone: string | undefined

    const booking = typeof payment.booking === 'object' ? payment.booking : null
    if (booking) {
      bookingRef = booking.bookingRef ?? undefined
      const guest = typeof booking.guest === 'object' ? booking.guest : null
      guestName = guest?.name ?? undefined
      guestEmail = guest?.email ?? undefined
      guestPhone = guest?.phone ?? undefined
    }

    const urls = getPaymentUrls(payment.id, bookingRef)
    const gateway = getPaymentGateway(body.gateway as GatewaySlug)

    const result = await gateway.initiate({
      payload: req.payload,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency ?? 'BDT',
      customer: { name: guestName, email: guestEmail, phone: guestPhone },
      ...urls,
    })

    const updated = await req.payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        gatewayRequestId: result.gatewayRequestId ?? undefined,
        status: 'pending',
        gatewayMetadata: { initiate: result.raw },
      },
      overrideAccess: true,
      context: { skipPaymentCascade: true },
    })

    return Response.json({ payment: updated, redirectUrl: result.redirectUrl })
  },
}

import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'
import { getPaymentGateway, type GatewaySlug } from '../lib/payments'

const API_GATEWAYS: GatewaySlug[] = ['bkash', 'nagad', 'sslcommerz', 'aamarpay']

function resolveId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    if (id != null) return id
  }
  return undefined
}

function coerceString(value: string | number | undefined): string | undefined {
  return value == null ? undefined : String(value)
}

export const paymentsVerifyEndpoint: Endpoint = {
  path: '/verify',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('Authentication required.', 401)

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { paymentId?: number; callbackData?: Record<string, unknown> }
    if (!body.paymentId) throw new APIError('paymentId is required.', 400)

    const payment = await req.payload.findByID({
      collection: 'payments',
      id: body.paymentId,
      depth: 2,
      overrideAccess: false,
      user: req.user,
    })

    if (!API_GATEWAYS.includes(payment.gateway as GatewaySlug)) {
      throw new APIError(`Gateway "${payment.gateway}" does not support verification.`, 400)
    }

    const gateway = getPaymentGateway(payment.gateway as GatewaySlug)
    const result = await gateway.verify({
      payload: req.payload,
      paymentId: payment.id,
      gatewayRequestId: coerceString(resolveId(payment.gatewayRequestId)),
      transactionId: coerceString(resolveId(payment.transactionId)),
      callbackData: body.callbackData,
    })

    const nextStatus =
      result.status === 'success'
        ? 'success'
        : result.status === 'failed'
          ? 'failed'
          : result.status === 'cancelled'
            ? 'cancelled'
            : 'pending'

    const updated = await req.payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: nextStatus,
        transactionId: result.transactionId ?? undefined,
        gatewayMetadata: { verify: result.raw },
      },
      overrideAccess: true,
      draft: false,
    })

    let bookingStatus: string | null = null
    const refreshedBooking = typeof updated.booking === 'object' ? updated.booking : null
    bookingStatus = refreshedBooking?.status ?? null


    return Response.json({
      paymentStatus: updated.status,
      transactionId: updated.transactionId ?? null,
      bookingStatus,
    })
  },
}

import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'
import { getPaymentGateway, type GatewaySlug } from '../lib/payments'

const API_GATEWAYS: GatewaySlug[] = ['bkash', 'nagad', 'sslcommerz', 'aamarpay']

function coerceString(value: string | number | undefined): string | undefined {
  return value == null ? undefined : String(value)
}

function resolveId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    if (id != null) return id
  }
  return undefined
}

async function findPayment(
  req: Parameters<Endpoint['handler']>[0],
  gateway: GatewaySlug,
): Promise<{ id: number } | null> {
  const data = (req.data ?? {}) as Record<string, unknown>
  const search = new URL(req.url ?? 'http://localhost/').searchParams

  const identifiers: string[] = [
    search.get('paymentId') ?? '',
    String(data.tran_id ?? ''),
    String(data.paymentID ?? ''),
    String(data.order_id ?? data.orderId ?? ''),
    String(data.mer_txnid ?? ''),
  ].filter(Boolean)

  for (const identifier of identifiers) {
    if (/^\d+$/.test(identifier)) {
      try {
        const doc = await req.payload.findByID({
          collection: 'payments',
          id: Number(identifier),
          depth: 0,
        })
        if (doc && doc.gateway === gateway) return { id: doc.id as number }
      } catch {
        continue
      }
    }

    const { docs } = await req.payload.find({
      collection: 'payments',
      where: {
        and: [
          { gateway: { equals: gateway } },
          {
            or: [
              { gatewayRequestId: { equals: identifier } },
              { transactionId: { equals: identifier } },
            ],
          },
        ],
      },
      limit: 1,
      depth: 0,
    })
    if (docs[0]) return { id: docs[0].id as number }
  }

  return null
}

export const paymentsWebhookEndpoint: Endpoint = {
  path: '/webhook/:gateway',
  method: 'post',
  handler: async (req) => {
    const gatewaySlug = req.routeParams?.gateway as GatewaySlug | undefined

    if (!gatewaySlug || !API_GATEWAYS.includes(gatewaySlug)) {
      throw new APIError('Unknown gateway.', 404)
    }

    let callbackData: Record<string, unknown> = {}
    const rawBody = typeof req.text === 'function' ? await req.text() : ''
    const contentType = req.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      try {
        callbackData = JSON.parse(rawBody) as Record<string, unknown>
      } catch {
        callbackData = {}
      }
    } else if (rawBody) {
      callbackData = Object.fromEntries(new URLSearchParams(rawBody))
    }

    const search = new URL(req.url ?? 'http://localhost/').searchParams
    for (const [key, value] of search.entries()) {
      callbackData[key] ??= value
    }

    const found = await findPayment(req, gatewaySlug)
    if (!found) {
      return Response.json({ received: true, matched: false })
    }

    const payment = await req.payload.findByID({
      collection: 'payments',
      id: found.id,
      depth: 0,
    })

    if (['success', 'refunded'].includes(payment.status)) {
      return Response.json({ received: true, status: payment.status })
    }

    const gateway = getPaymentGateway(gatewaySlug)
    const result = await gateway.verify({
      payload: req.payload,
      paymentId: payment.id,
      gatewayRequestId: coerceString(resolveId(payment.gatewayRequestId)),
      transactionId: coerceString(resolveId(payment.transactionId)),
      callbackData,
    })

    const nextStatus =
      result.status === 'success'
        ? 'success'
        : result.status === 'failed'
          ? 'failed'
          : result.status === 'cancelled'
            ? 'cancelled'
            : 'pending'

    await req.payload.update({
      collection: 'payments',
      id: payment.id,
      data: {
        status: nextStatus,
        transactionId: result.transactionId ?? undefined,
        gatewayMetadata: { webhook: result.raw },
      },
      overrideAccess: true,
      draft: false,
    })

    return Response.json({ received: true, status: nextStatus })
  },
}

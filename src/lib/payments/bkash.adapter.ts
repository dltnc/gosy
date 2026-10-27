import type {
  InitiatePaymentArgs,
  InitiatePaymentResult,
  PaymentGateway,
  RefundPaymentArgs,
  RefundPaymentResult,
  VerifyPaymentArgs,
  VerifyPaymentResult,
} from './gateway.interface'
import { getBkashConfig } from './config'

interface BkashTokenResponse {
  id_token: string
  status_code?: string
}

interface BkashCreateResponse {
  paymentID?: string
  bkashURL?: string
  statusCode?: string
  statusMessage?: string
}

interface BkashExecuteResponse {
  paymentID?: string
  trxID?: string
  transactionStatus?: string
  statusCode?: string
  statusMessage?: string
}

async function bkashRequest<T>(
  config: Awaited<ReturnType<typeof getBkashConfig>>,
  path: string,
  idToken: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${config.baseURL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: idToken,
      'X-App-Key': config.appKey,
    },
    body: JSON.stringify(body),
  })
  return (await res.json()) as T
}

export const bKashGateway: PaymentGateway = {
  slug: 'bkash',

  async initiate(args: InitiatePaymentArgs): Promise<InitiatePaymentResult> {
    const config = await getBkashConfig(args.payload)

    const tokenRes = await fetch(`${config.baseURL}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: config.username,
        password: config.password,
      },
      body: JSON.stringify({ app_key: config.appKey, app_secret: config.appSecret }),
    })
    const token = (await tokenRes.json()) as BkashTokenResponse
    if (!token.id_token) {
      throw new Error(`bKash token grant failed: ${JSON.stringify(token)}`)
    }

    const created = await bkashRequest<BkashCreateResponse>(
      config,
      '/tokenized/checkout/create',
      token.id_token,
      {
        mode: '0011',
        payerReference: String(args.paymentId),
        callbackURL: args.webhookUrl ?? args.successUrl,
        amount: String(args.amount),
        currency: args.currency,
        intent: 'sale',
        merchantInvoiceNumber: `INV-${args.paymentId}`,
      },
    )

    if (!created.paymentID || !created.bkashURL) {
      throw new Error(`bKash create failed: ${created.statusMessage ?? JSON.stringify(created)}`)
    }

    return {
      redirectUrl: created.bkashURL,
      gatewayRequestId: created.paymentID,
      raw: created,
    }
  },

  async verify(args: VerifyPaymentArgs): Promise<VerifyPaymentResult> {
    const config = await getBkashConfig(args.payload)
    const paymentID = args.gatewayRequestId ?? args.transactionId

    if (!paymentID) {
      return { success: false, status: 'pending' }
    }

    const tokenRes = await fetch(`${config.baseURL}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        username: config.username,
        password: config.password,
      },
      body: JSON.stringify({ app_key: config.appKey, app_secret: config.appSecret }),
    })
    const token = (await tokenRes.json()) as BkashTokenResponse
    if (!token.id_token) {
      throw new Error('bKash token grant failed during verify')
    }

    const executed = await bkashRequest<BkashExecuteResponse>(
      config,
      '/tokenized/checkout/execute',
      token.id_token,
      { paymentID },
    )

    if (executed.statusCode === '2002' || /already/i.test(executed.statusMessage ?? '')) {
      const queried = await bkashRequest<BkashExecuteResponse & { trxID?: string }>(
        config,
        '/tokenized/checkout/payment/status',
        token.id_token,
        { paymentID },
      )
      return mapStatus(queried.transactionStatus, queried.trxID, queried)
    }

    return mapStatus(executed.transactionStatus, executed.trxID, executed)
  },

  async refund(args: RefundPaymentArgs): Promise<RefundPaymentResult> {
    if (!args.transactionId || !args.gatewayRequestId) {
      return { success: false, manualRequired: true }
    }
    const config = await getBkashConfig(args.payload)
    const tokenRes = await fetch(`${config.baseURL}/tokenized/checkout/token/grant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        username: config.username,
        password: config.password,
      },
      body: JSON.stringify({ app_key: config.appKey, app_secret: config.appSecret }),
    })
    const token = (await tokenRes.json()) as BkashTokenResponse

    const refunded = await bkashRequest<{ completedTime?: string; transactionStatus?: string }>(
      config,
      '/tokenized/checkout/refund',
      token.id_token ?? '',
      {
        paymentID: args.gatewayRequestId,
        trxID: args.transactionId,
        amount: String(args.amount),
        sku: 'refund',
        reason: args.reason ?? 'customer refund',
      },
    )

    return {
      success: refunded.transactionStatus === 'Completed',
      raw: refunded,
    }
  },
}

function mapStatus(
  transactionStatus: string | undefined,
  trxID: string | undefined,
  raw: unknown,
): VerifyPaymentResult {
  switch (transactionStatus) {
    case 'Completed':
      return { success: true, status: 'success', transactionId: trxID, raw }
    case 'Failed':
      return { success: false, status: 'failed', raw }
    case 'Canceled':
    case 'Cancelled':
      return { success: false, status: 'cancelled', raw }
    default:
      return { success: false, status: 'pending', raw }
  }
}

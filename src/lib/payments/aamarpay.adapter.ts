import type {
  InitiatePaymentArgs,
  InitiatePaymentResult,
  PaymentGateway,
  RefundPaymentArgs,
  RefundPaymentResult,
  VerifyPaymentArgs,
  VerifyPaymentResult,
} from './gateway.interface'
import { getAmarPayConfig } from './config'

interface AmarPayInitiateResponse {
  result?: string
  redirect_url?: string
}

interface AmarPayVerifyResponse {
  result?: string
  status?: string
  tran_id?: string
}

export const amarPayGateway: PaymentGateway = {
  slug: 'aamarpay',

  async initiate(args: InitiatePaymentArgs): Promise<InitiatePaymentResult> {
    const config = await getAmarPayConfig(args.payload)

    const body = {
      store_id: config.storeId,
      signature_key: config.signatureKey,
      tran_id: String(args.paymentId),
      success_url: `${args.successUrl}?paymentId=${args.paymentId}`,
      fail_url: `${args.failureUrl}?paymentId=${args.paymentId}`,
      cancel_url: `${args.cancelUrl}?paymentId=${args.paymentId}`,
      amount: String(args.amount),
      currency: 'BDT',
      desc: args.customer?.email ?? 'Booking payment',
      cus_name: args.customer?.name ?? 'Guest',
      cus_email: args.customer?.email ?? 'guest@example.com',
      cus_phone: args.customer?.phone ?? '',
      cus_add1: 'N/A',
      cus_city: 'N/A',
      cus_country: 'Bangladesh',
    }

    const res = await fetch(`${config.baseURL}/jsonpost.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = (await res.json()) as AmarPayInitiateResponse

    if (!data.redirect_url) {
      throw new Error(`AmarPay initiate failed: ${JSON.stringify(data)}`)
    }

    return { redirectUrl: data.redirect_url, gatewayRequestId: String(args.paymentId), raw: data }
  },

  async verify(args: VerifyPaymentArgs): Promise<VerifyPaymentResult> {
    const config = await getAmarPayConfig(args.payload)
    const tranId =
      (args.callbackData?.tran_id as string | undefined) ??
      (args.transactionId ?? undefined) ??
      (args.gatewayRequestId ?? undefined)

    if (!tranId) {
      return { success: false, status: 'pending' }
    }

    const res = await fetch(`${config.baseURL}/merchant/txncheck.php/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_id: config.storeId,
        signature_key: config.signatureKey,
        request_id: tranId,
        type: 'json',
      }),
    })

    const data = (await res.json()) as AmarPayVerifyResponse
    const status = (data.status ?? data.result ?? '').toLowerCase()

    if (status === 'complete' || status === 'success') {
      return { success: true, status: 'success', transactionId: data.tran_id ?? tranId, raw: data }
    }
    if (status === 'failed') {
      return { success: false, status: 'failed', raw: data }
    }
    if (status === 'cancel' || status === 'canceled') {
      return { success: false, status: 'cancelled', raw: data }
    }

    return { success: false, status: 'pending', raw: data }
  },

  async refund(_args: RefundPaymentArgs): Promise<RefundPaymentResult> {
    return { success: false, manualRequired: true }
  },
}

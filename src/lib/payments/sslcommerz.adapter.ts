import type {
  InitiatePaymentArgs,
  InitiatePaymentResult,
  PaymentGateway,
  RefundPaymentArgs,
  RefundPaymentResult,
  VerifyPaymentArgs,
  VerifyPaymentResult,
} from './gateway.interface'
import { getSslCommerzConfig } from './config'

interface SslSessionResponse {
  status?: string
  GatewayPageURL?: string
  sessionkey?: string
  failedreason?: string
}

interface SslValidatorResponse {
  status?: string
  tran_id?: string
  val_id?: string
  amount?: string | number
  bank_tran_id?: string
}

export const sslCommerzGateway: PaymentGateway = {
  slug: 'sslcommerz',

  async initiate(args: InitiatePaymentArgs): Promise<InitiatePaymentResult> {
    const config = await getSslCommerzConfig(args.payload)

    const body = new URLSearchParams({
      store_id: config.storeId,
      store_passwd: config.storePassword,
      total_amount: String(args.amount),
      currency: args.currency,
      tran_id: String(args.paymentId),
      success_url: `${args.successUrl}?paymentId=${args.paymentId}`,
      fail_url: `${args.failureUrl}?paymentId=${args.paymentId}`,
      cancel_url: `${args.cancelUrl}?paymentId=${args.paymentId}`,
      shipping_method: 'No',
      emi_options: '0',
      cus_name: args.customer?.name ?? 'Guest',
      cus_email: args.customer?.email ?? 'guest@example.com',
      cus_phone: args.customer?.phone ?? '',
      cus_add1: 'N/A',
      cus_city: 'N/A',
      cus_country: 'Bangladesh',
    })

    const res = await fetch(`${config.baseURL}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const data = (await res.json()) as SslSessionResponse

    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      throw new Error(`SSLCommerz session failed: ${data.failedreason ?? JSON.stringify(data)}`)
    }

    return {
      redirectUrl: data.GatewayPageURL,
      gatewayRequestId: data.sessionkey ?? null,
      raw: data,
    }
  },

  async verify(args: VerifyPaymentArgs): Promise<VerifyPaymentResult> {
    const config = await getSslCommerzConfig(args.payload)
    const valId =
      (args.callbackData?.val_id as string | undefined) ??
      (args.gatewayRequestId ?? undefined) ??
      (args.transactionId ?? undefined)

    if (!valId) {
      return { success: false, status: 'pending' }
    }

    const params = new URLSearchParams({
      val_id: String(valId),
      store_id: config.storeId,
      store_passwd: config.storePassword,
      format: 'json',
    })

    const res = await fetch(`${config.baseURL}/validator/api/validationserverAPI.php?${params}`)
    const data = (await res.json()) as SslValidatorResponse

    if (data.status === 'VALIDATED' || data.status === 'VALID') {
      return {
        success: true,
        status: 'success',
        transactionId: data.bank_tran_id ?? data.val_id,
        raw: data,
      }
    }

    if (data.status === 'FAILED') {
      return { success: false, status: 'failed', raw: data }
    }
    if (data.status === 'CANCELLED') {
      return { success: false, status: 'cancelled', raw: data }
    }

    return { success: false, status: 'pending', raw: data }
  },

  async refund(args: RefundPaymentArgs): Promise<RefundPaymentResult> {
    if (!args.transactionId) {
      return { success: false, manualRequired: true }
    }
    const config = await getSslCommerzConfig(args.payload)

    const params = new URLSearchParams({
      bank_tran_id: args.transactionId,
      refund_amount: String(args.amount),
      store_id: config.storeId,
      store_passwd: config.storePassword,
      format: 'json',
    })

    const res = await fetch(`${config.baseURL}/validator/api/merchantTransIDvalidationAPI.php?${params}`)
    const data = (await res.json()) as { status?: string; error?: string }

    return {
      success: data.status === 'success' || /refund/i.test(data.status ?? ''),
      manualRequired: !data.status && Boolean(data.error),
      raw: data,
    }
  },
}

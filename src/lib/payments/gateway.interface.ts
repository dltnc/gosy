import type { Payload } from 'payload'

export type GatewaySlug = 'bkash' | 'nagad' | 'sslcommerz' | 'aamarpay'

export interface CustomerInfo {
  name?: string
  email?: string
  phone?: string
}

export interface InitiatePaymentArgs {
  payload: Payload
  paymentId: string | number
  amount: number
  currency: string
  customer?: CustomerInfo
  successUrl: string
  failureUrl: string
  cancelUrl: string
  webhookUrl?: string
}

export interface InitiatePaymentResult {
  redirectUrl: string | null
  gatewayRequestId?: string | null
  transactionId?: string | null
  raw?: unknown
}

export interface VerifyPaymentArgs {
  payload: Payload
  paymentId: string | number
  gatewayRequestId?: string | null
  transactionId?: string | null
  callbackData?: Record<string, unknown>
}

export interface VerifyPaymentResult {
  success: boolean
  status: 'success' | 'failed' | 'cancelled' | 'pending'
  transactionId?: string | null
  raw?: unknown
}

export interface RefundPaymentArgs {
  payload: Payload
  paymentId: string | number
  transactionId?: string | null
  gatewayRequestId?: string | null
  amount: number
  reason?: string
}

export interface RefundPaymentResult {
  success: boolean
  manualRequired?: boolean
  raw?: unknown
}

export interface PaymentGateway {
  slug: GatewaySlug
  initiate(args: InitiatePaymentArgs): Promise<InitiatePaymentResult>
  verify(args: VerifyPaymentArgs): Promise<VerifyPaymentResult>
  refund?(args: RefundPaymentArgs): Promise<RefundPaymentResult>
}

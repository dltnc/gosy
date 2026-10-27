import type { InitiatePaymentArgs } from './gateway.interface'

function appUrl(): string {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
}

export function getPaymentUrls(paymentId: string | number, bookingRef?: string): {
  successUrl: string
  failureUrl: string
  cancelUrl: string
  webhookUrl: string
} {
  const base = appUrl().replace(/\/$/, '')
  const landing = bookingRef
    ? `${base}/booking/${bookingRef}/payment-status`
    : `${base}/payment-status/${paymentId}`

  const apiBase = process.env.API_URL || base

  return {
    successUrl: landing,
    failureUrl: landing,
    cancelUrl: landing,
    webhookUrl: `${apiBase.replace(/\/$/, '')}/api/payments/webhook/generic?paymentId=${paymentId}`,
  }
}

export type { InitiatePaymentArgs }

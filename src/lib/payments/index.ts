import type { Payload } from 'payload'
import type { GatewaySlug, PaymentGateway } from './gateway.interface'
import { bKashGateway } from './bkash.adapter'
import { sslCommerzGateway } from './sslcommerz.adapter'
import { nagadGateway } from './nagad.adapter'
import { amarPayGateway } from './aamarpay.adapter'

const GATEWAYS: Record<Exclude<GatewaySlug, never>, PaymentGateway> = {
  bkash: bKashGateway,
  sslcommerz: sslCommerzGateway,
  nagad: nagadGateway,
  aamarpay: amarPayGateway,
}

export function getPaymentGateway(slug: GatewaySlug): PaymentGateway {
  const gateway = GATEWAYS[slug]
  if (!gateway) {
    throw new Error(`Unknown payment gateway: ${slug}`)
  }
  return gateway
}

export async function getEnabledPaymentGateways(payload: Payload): Promise<GatewaySlug[]> {
  const settings = await payload.findGlobal({ slug: 'platform-settings', depth: 0 })
  const gateways = settings?.paymentGateways as
    | Record<string, { enabled?: boolean }>
    | undefined

  return (Object.keys(GATEWAYS) as GatewaySlug[]).filter((slug) =>
    Boolean(gateways?.[slug]?.enabled),
  )
}

export type { GatewaySlug } from './gateway.interface'

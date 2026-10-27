import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'

import { getPaymentGateway, type GatewaySlug } from '../lib/payments'
import { isGatewayEnabled } from '../lib/payments/config'
import { loadPartnerSubscriptions, resolvePropertyState } from '../lib/subscriptions/state'

/**
 * Buy or renew a property subscription.
 *
 * Exists as an endpoint rather than letting the dashboard POST a subscription row plus a payment row
 * because the *price* must not come from the client. The plan is the only thing the partner chooses;
 * the amount, the currency and the link between the payment and the subscription are all read from
 * the plan on the server, so a crafted request cannot buy a featured slot for ৳1.
 *
 * Activation is not done here either. The subscription is created `pending_payment` and only the
 * payment cascade in `Payments.afterChange` flips it to `active`, which is what copies the plan
 * benefits onto the property. So there is exactly one path from money to visibility.
 */

const API_GATEWAYS: GatewaySlug[] = ['bkash', 'nagad', 'sslcommerz', 'aamarpay']

interface CheckoutBody {
  propertyId?: number | string
  planId?: number | string
  gateway?: string
  transferReference?: string
  senderName?: string
  senderAccountNumber?: string
  receipt?: number
}

function resolveId(value: unknown): number | string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' || typeof value === 'string') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: number | string }).id
    if (id != null) return id
  }
  return null
}

/** Where the gateway sends the partner back to. There is no public receipt page for a subscription. */
function subscriptionUrls(paymentId: number | string) {
  const base = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')
  const landing = `${base}/partner/subscriptions?payment=${paymentId}`
  const apiBase = (process.env.API_URL || base).replace(/\/$/, '')
  return {
    successUrl: landing,
    failureUrl: landing,
    cancelUrl: landing,
    webhookUrl: `${apiBase}/api/payments/webhook/generic?paymentId=${paymentId}`,
  }
}

export const subscriptionCheckoutEndpoint: Endpoint = {
  path: '/checkout',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('Authentication required.', 401)
    const isAdmin = req.user.role === 'admin'
    if (!isAdmin && req.user.role !== 'partner') {
      throw new APIError('Only partners can subscribe a property.', 403)
    }

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as CheckoutBody
    if (!body.propertyId) throw new APIError('propertyId is required.', 400)
    if (!body.planId) throw new APIError('planId is required.', 400)

    const property = await req.payload.findByID({
      collection: 'properties',
      id: body.propertyId,
      depth: 0,
      overrideAccess: true,
    })
    // Read access on properties is public for approved listings, so ownership is checked explicitly
    // rather than inferred from being able to load the row.
    if (!isAdmin && String(resolveId(property.partner)) !== String(req.user.id)) {
      throw new APIError('You can only subscribe your own properties.', 403)
    }

    const plan = await req.payload.findByID({
      collection: 'subscription-plans',
      id: body.planId,
      depth: 0,
      overrideAccess: true,
    })
    if (!plan.active) throw new APIError('This plan is no longer available.', 400)

    // Overlap guard. Two live subscriptions on one property would bill for days the partner already
    // owns, and `activateAndSetDates` starts the clock at activation rather than at the old end date,
    // so the second period would quietly swallow the first.
    const partnerId = resolveId(property.partner) ?? req.user.id
    const state = resolvePropertyState(
      property.id,
      await loadPartnerSubscriptions(req.payload, partnerId, { req }),
    )
    if (state.awaitingPayment) {
      throw new APIError(
        'A subscription for this property is already awaiting payment. Complete or cancel it first.',
        409,
      )
    }
    if (state.current?.live) {
      throw new APIError(
        `This property is already subscribed until ${new Date(
          state.current.endDate ?? '',
        ).toLocaleDateString('en-GB')}. Renew once the current period ends.`,
        409,
      )
    }

    const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })
    const gatewaySlug = body.gateway ?? 'bank_transfer'
    const amount = Number(plan.price) || 0
    const currency = settings.currency ?? 'BDT'

    const subscription = await req.payload.create({
      collection: 'property-subscriptions',
      data: { property: property.id, plan: plan.id, status: 'pending_payment' },
      overrideAccess: true,
      draft: false,
    })

    // A free plan has nothing to pay for, so it activates directly. Going through a ৳0 gateway
    // payment would only create a row that no gateway will ever confirm.
    if (amount <= 0) {
      const activated = await req.payload.update({
        collection: 'property-subscriptions',
        id: subscription.id,
        data: { status: 'active' },
        overrideAccess: true,
      })
      return Response.json({
        subscription: activated,
        payment: null,
        redirectUrl: null,
        message: 'Subscription activated.',
      })
    }

    if (!API_GATEWAYS.includes(gatewaySlug as GatewaySlug)) {
      if (gatewaySlug !== 'bank_transfer' && !isAdmin) {
        throw new APIError('Choose an online gateway or bank transfer.', 400)
      }
      if (gatewaySlug === 'bank_transfer' && !body.transferReference?.trim()) {
        throw new APIError('Enter the transfer reference from your bank slip.', 400)
      }
      // Status `pending`, never `success`: an admin verifies the slip in the admin panel, and that
      // verification is what activates the subscription.
      const payment = await req.payload.create({
        collection: 'payments',
        data: {
          purpose: 'subscription_payment',
          gateway: gatewaySlug as GatewaySlug,
          status: 'pending',
          amount,
          currency,
          propertySubscription: subscription.id,
          ...(gatewaySlug === 'bank_transfer'
            ? {
                bankTransferDetails: {
                  senderName: body.senderName?.trim() || undefined,
                  senderAccountNumber: body.senderAccountNumber?.trim() || undefined,
                  transferReference: body.transferReference?.trim(),
                  receipt: body.receipt ? Number(body.receipt) : undefined,
                  paidAt: new Date().toISOString(),
                },
              }
            : {}),
        },
        overrideAccess: true,
        context: { skipPaymentCascade: true },
        draft: false,
      })

      return Response.json({
        subscription,
        payment,
        redirectUrl: null,
        message:
          'Transfer details submitted. The subscription starts once the platform verifies it.',
      })
    }

    if (!isGatewayEnabled(settings, gatewaySlug as GatewaySlug)) {
      throw new APIError(`Payment gateway "${gatewaySlug}" is not available.`, 400)
    }

    const payment = await req.payload.create({
      collection: 'payments',
      data: {
        purpose: 'subscription_payment',
        gateway: gatewaySlug as GatewaySlug,
        status: 'initiated',
        amount,
        currency,
        propertySubscription: subscription.id,
      },
      overrideAccess: true,
      context: { skipPaymentCascade: true },
      draft: false,
    })

    const gateway = getPaymentGateway(gatewaySlug as GatewaySlug)
    const result = await gateway.initiate({
      payload: req.payload,
      paymentId: payment.id,
      amount,
      currency,
      customer: {
        name: req.user.name ?? undefined,
        email: req.user.email ?? undefined,
        phone: req.user.phone ?? undefined,
      },
      ...subscriptionUrls(payment.id),
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

    return Response.json({
      subscription,
      payment: updated,
      redirectUrl: result.redirectUrl,
    })
  },
}

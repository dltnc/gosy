import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SubscriptionPaymentReturn } from '@/features/partner/components/subscription-payment-return'
import { SubscriptionPurchaseForm } from '@/features/partner/components/subscription-purchase-form'
import type {
  GatewayOption,
  SubscribablePropertyOption,
  SubscriptionPlanOption,
} from '@/features/partner/components/subscription-purchase-form'
import { requirePartner } from '@/features/partner/guard'
import { isGatewayEnabled } from '@/lib/payments/config'
import type { GatewaySlug } from '@/lib/payments'
import {
  loadPartnerSubscriptions,
  RENEWAL_WINDOW_DAYS,
  resolvePropertyState,
} from '@/lib/subscriptions/state'

/**
 * Where a partner buys visibility.
 *
 * Every number on this page is derived from `resolvePropertyState` rather than from the stored
 * status, because the daily expiry job lags the clock: a row can still say `active` after its end
 * date. Promising promotion the search ranking has already withdrawn is the one mistake this page
 * must not make.
 */

export const metadata: Metadata = {
  title: 'Subscriptions',
}

const GATEWAY_LABELS: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  sslcommerz: 'Card / SSLCommerz',
  aamarpay: 'aamarPay',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  pending_payment: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-700',
  cancelled: 'bg-muted text-muted-foreground',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  pending_payment: 'Awaiting payment',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

function money(amount: number): string {
  return amount > 0 ? `৳${amount.toLocaleString('en-US')}` : 'Free'
}

function day(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

interface SubscriptionsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PartnerSubscriptionsPage({ searchParams }: SubscriptionsPageProps) {
  const [{ payload, user }, query] = await Promise.all([
    requirePartner('/partner/subscriptions'),
    searchParams,
  ])

  // Scoped to the signed-in account even for an admin: this page buys promotion for *your* listings,
  // and an admin managing someone else's subscription does it in the admin panel.
  const [{ docs: properties }, { docs: plans }, settings, subscriptions] = await Promise.all([
    payload.find({
      collection: 'properties',
      where: { partner: { equals: user.id } },
      sort: 'name',
      limit: 100,
      depth: 0,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'subscription-plans',
      where: { active: { equals: true } },
      sort: 'sortOrder',
      limit: 20,
      depth: 0,
    }),
    payload.findGlobal({ slug: 'platform-settings', depth: 0 }),
    loadPartnerSubscriptions(payload, user.id),
  ])

  const states = properties.map((property) => ({
    property,
    state: resolvePropertyState(property.id, subscriptions),
  }))

  const propertyOptions: SubscribablePropertyOption[] = states.map(({ property, state }) => ({
    id: property.id,
    name: property.name ?? `Property #${property.id}`,
    blockedReason: state.canPurchase
      ? null
      : state.awaitingPayment
        ? 'A payment is already awaiting confirmation.'
        : `Subscribed until ${day(state.current?.endDate)}.`,
  }))

  const planOptions: SubscriptionPlanOption[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: Number(plan.price) || 0,
    durationDays: Number(plan.durationDays) || 0,
    description: plan.description ?? null,
    priorityScore: plan.benefits?.priorityScore ?? null,
    badgeText: plan.benefits?.badgeText ?? null,
  }))

  // Only gateways an admin has switched on, plus bank transfer, which always works because a human
  // verifies it. Offering a disabled gateway would fail after the partner had already committed.
  const gatewayOptions: GatewayOption[] = [
    ...(['bkash', 'nagad', 'sslcommerz', 'aamarpay'] as GatewaySlug[])
      .filter((slug) => isGatewayEnabled(settings, slug))
      .map((slug) => ({ slug, label: GATEWAY_LABELS[slug] ?? slug })),
    { slug: 'bank_transfer', label: 'Bank transfer (manual verification)' },
  ]

  const account = settings.bankTransferAccounts?.[0]
  const bankInstructions = account
    ? `Transfer to ${account.accountName} · ${account.bankName} · A/C ${account.accountNumber}${
        account.branchName ? ` · ${account.branchName} branch` : ''
      }${account.routingNumber ? ` · routing ${account.routingNumber}` : ''}, then enter the reference below.`
    : null

  const paymentParam = Array.isArray(query.payment) ? query.payment[0] : query.payment
  let returning: { id: number | string; status: string; gateway: string } | null = null
  if (paymentParam) {
    const { docs: payments } = await payload.find({
      collection: 'payments',
      where: { id: { equals: paymentParam } },
      limit: 1,
      depth: 0,
      overrideAccess: false,
      user,
    })
    const payment = payments[0]
    if (payment) {
      returning = { id: payment.id, status: payment.status ?? 'pending', gateway: payment.gateway }
    }
  }

  const activeCount = states.filter(({ state }) => state.current?.live).length

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
        <p className="text-sm text-muted-foreground">
          A subscription promotes one property: it is marked as featured and ranks above
          unsubscribed listings for the length of the plan. {activeCount} of {properties.length}{' '}
          {properties.length === 1 ? 'property is' : 'properties are'} promoted right now.
        </p>
      </header>

      {returning ? (
        <SubscriptionPaymentReturn
          paymentId={returning.id}
          initialStatus={returning.status}
          gateway={returning.gateway}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <SubscriptionPurchaseForm
          properties={propertyOptions}
          plans={planOptions}
          gateways={gatewayOptions}
          bankInstructions={bankInstructions}
        />

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-primary">Plans</h2>
          {planOptions.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
              No plans are on sale right now.
            </p>
          ) : (
            planOptions.map((plan) => (
              <Card key={plan.id}>
                <CardContent className="space-y-1 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-bold">{plan.name}</p>
                    <p className="font-extrabold text-primary">{money(plan.price)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {plan.durationDays} days
                    {plan.priorityScore != null ? ` · priority ${plan.priorityScore}/100` : ''}
                  </p>
                  {plan.description ? <p className="text-sm">{plan.description}</p> : null}
                  {plan.badgeText ? (
                    <Badge variant="outline" className="bg-primary-fixed">
                      {plan.badgeText}
                    </Badge>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-primary">Your properties</h2>
        {properties.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">No properties yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a property first, then promote it from here.{' '}
              <Link href="/partner/properties/new" className="underline underline-offset-4">
                Add a property
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {states.map(({ property, state }) => {
              const current = state.current
              return (
                <Card key={property.id}>
                  <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/partner/properties/${property.id}`}
                          className="font-semibold underline-offset-4 hover:underline"
                        >
                          {property.name ?? `Property #${property.id}`}
                        </Link>
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[current?.status ?? ''] ?? 'bg-muted'}
                        >
                          {current
                            ? (STATUS_LABELS[current.status] ?? current.status)
                            : 'Not promoted'}
                        </Badge>
                        {current?.planName ? (
                          <span className="text-xs text-muted-foreground">{current.planName}</span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {current?.live
                          ? `Promoted until ${day(current.endDate)} · ${current.daysRemaining} days left`
                          : current?.status === 'pending_payment'
                            ? 'Waiting for the payment to be confirmed.'
                            : current
                              ? `Promotion ended ${day(current.endDate)}. Buy a plan above to start again.`
                              : 'Never promoted. Buy a plan above to lift it in search results.'}
                      </p>
                      {current?.expiringSoon ? (
                        <p className="text-sm font-medium text-amber-700">
                          Expires within {RENEWAL_WINDOW_DAYS} days — renew once it ends to keep the
                          slot.
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

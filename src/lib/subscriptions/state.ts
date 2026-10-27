import type { Payload, PayloadRequest } from 'payload'

/**
 * What a partner's property subscription is worth *right now*.
 *
 * The stored `status` lags the clock: `expireSubscriptions` flips `active → expired` on a daily job,
 * so between the end date and the next run a row still says `active` while the benefits have really
 * lapsed. Everything here derives from the end date first and the stored status second, so the
 * dashboard never promises visibility the search ranking has already stopped giving.
 */

export const SUBSCRIPTION_STATUSES = ['pending_payment', 'active', 'expired', 'cancelled'] as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/** Days of remaining cover below which the dashboard nudges a renewal. */
export const RENEWAL_WINDOW_DAYS = 7

const MS_PER_DAY = 86_400_000

export interface RawSubscription {
  id: number | string
  status?: string | null
  startDate?: string | null
  endDate?: string | null
  property?: number | string | { id: number | string } | null
  plan?:
    number | string | { id: number | string; name?: string | null; price?: number | null } | null
}

export interface SubscriptionView {
  id: number | string
  status: SubscriptionStatus
  planId: number | string | null
  planName: string | null
  startDate: string | null
  endDate: string | null
  /** Whole days of cover left. `null` when there is no end date to count towards. */
  daysRemaining: number | null
  /** Stored status is `active` *and* the end date has not passed. */
  live: boolean
  expiringSoon: boolean
}

export interface PropertySubscriptionState {
  propertyId: number | string
  /** The row that decides this property's standing: the live one, else the newest by end date. */
  current: SubscriptionView | null
  /** A payment already filed and waiting, so a second purchase would double-charge. */
  awaitingPayment: SubscriptionView | null
  /** True when a purchase is allowed: nothing live, nothing awaiting payment. */
  canPurchase: boolean
}

function idOf(
  value: RawSubscription['property'] | RawSubscription['plan'],
): number | string | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') return value
  return value.id ?? null
}

function daysUntil(endDate: string | null, now: number): number | null {
  if (!endDate) return null
  const end = new Date(endDate).getTime()
  if (!Number.isFinite(end)) return null
  return Math.max(Math.ceil((end - now) / MS_PER_DAY), 0)
}

/** Normalise one stored row into what the dashboard needs to say about it. */
export function toView(subscription: RawSubscription, now: Date = new Date()): SubscriptionView {
  const status = (subscription.status ?? 'pending_payment') as SubscriptionStatus
  const endDate = subscription.endDate ?? null
  const daysRemaining = daysUntil(endDate, now.getTime())
  const plan = subscription.plan
  const live = status === 'active' && (daysRemaining == null || daysRemaining > 0)

  return {
    id: subscription.id,
    status,
    planId: idOf(plan),
    planName: plan && typeof plan === 'object' ? (plan.name ?? null) : null,
    startDate: subscription.startDate ?? null,
    endDate,
    daysRemaining,
    live,
    expiringSoon: live && daysRemaining != null && daysRemaining <= RENEWAL_WINDOW_DAYS,
  }
}

function endTime(view: SubscriptionView): number {
  if (!view.endDate) return 0
  const time = new Date(view.endDate).getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * Fold every subscription row for one property into a single answer.
 *
 * Kept pure so the lag between the end date and the expiry job can be tested without a database.
 */
export function resolvePropertyState(
  propertyId: number | string,
  subscriptions: RawSubscription[],
  now: Date = new Date(),
): PropertySubscriptionState {
  const views = subscriptions
    .filter((row) => String(idOf(row.property)) === String(propertyId))
    .map((row) => toView(row, now))

  const live = views.filter((view) => view.live).sort((a, b) => endTime(b) - endTime(a))[0] ?? null
  const awaitingPayment = views.find((view) => view.status === 'pending_payment') ?? null
  // Falls back to the newest lapsed row so the page can say "expired on 3 June" rather than nothing.
  const newest = views.slice().sort((a, b) => endTime(b) - endTime(a))[0] ?? null

  return {
    propertyId,
    current: live ?? newest,
    awaitingPayment,
    canPurchase: !live && !awaitingPayment,
  }
}

/** Every subscription row belonging to this partner's properties. */
export async function loadPartnerSubscriptions(
  payload: Payload,
  partnerId: string | number,
  options: { req?: PayloadRequest } = {},
): Promise<RawSubscription[]> {
  const { docs } = await payload.find({
    collection: 'property-subscriptions',
    where: { 'property.partner': { equals: partnerId } },
    sort: '-createdAt',
    limit: 200,
    depth: 1,
    overrideAccess: true,
    ...(options.req ? { req: options.req } : {}),
  })
  return docs as RawSubscription[]
}

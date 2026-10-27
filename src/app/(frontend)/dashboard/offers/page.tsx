import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'

import type { Coupon } from '@/payload-types'
import { BOOKING_ACTIVE_STATUSES } from '@/lib/bookings/statuses'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'My offers',
}

const TIER_LABELS: Record<string, string> = {
  budget: 'Budget',
  standard: 'Standard',
  premium: 'Premium',
  flagship: 'Flagship',
}

function relationId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as { id: string | number }).id)
  }
  return null
}

function scopeLabel(coupon: Coupon): string {
  switch (coupon.scope) {
    case 'specific_properties': {
      const count = coupon.scopeProperties?.length ?? 0
      return count === 1 ? 'One selected stay' : `${count} selected stays`
    }
    case 'tier':
      return `${TIER_LABELS[coupon.scopeTier ?? ''] ?? 'Selected'} stays`
    case 'city':
      return coupon.scopeCity ? `Stays in ${coupon.scopeCity}` : 'Selected city'
    default:
      return 'Any stay'
  }
}

function discountLabel(coupon: Coupon): string {
  return coupon.discountType === 'percent'
    ? `${coupon.discountValue}% off`
    : `৳${coupon.discountValue.toLocaleString('en-US')} off`
}

/**
 * Why the coupon is out of reach for this guest, or null when it is usable.
 * Only the guest-scoped rules are checked here — the amount- and property-scoped
 * ones (min spend, scope match) can't be judged without a basket, so they stay
 * with `validateCoupon` at checkout.
 */
function blockedReason(
  coupon: Coupon,
  timesUsed: number,
  isFirstBooking: boolean,
): string | null {
  if (coupon.usesPerUser != null && coupon.usesPerUser > 0 && timesUsed >= coupon.usesPerUser) {
    return timesUsed === 1 ? 'Already used' : `Used ${timesUsed} times`
  }
  if (
    coupon.usageLimitTotal != null &&
    coupon.usageLimitTotal > 0 &&
    (coupon.currentUsageCount ?? 0) >= coupon.usageLimitTotal
  ) {
    return 'Fully claimed'
  }
  if (coupon.firstBookingOnly && !isFirstBooking) {
    return 'First booking only'
  }
  return null
}

export default async function DashboardOffersPage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const now = new Date().toISOString()

  const [{ docs: coupons }, { docs: couponedBookings }, { totalDocs: countedStays }] =
    await Promise.all([
      payload.find({
        collection: 'coupons',
        where: {
          and: [
            { active: { equals: true } },
            { or: [{ validFrom: { exists: false } }, { validFrom: { less_than_equal: now } }] },
            { or: [{ validUntil: { exists: false } }, { validUntil: { greater_than: now } }] },
          ],
        },
        sort: '-createdAt',
        limit: 50,
        depth: 0,
        overrideAccess: false,
        user,
      }),
      // Usage is counted per booking regardless of status, matching the
      // `usesPerUser` check that runs when a coupon is applied.
      payload.find({
        collection: 'bookings',
        where: {
          and: [{ guest: { equals: user!.id } }, { couponApplied: { exists: true } }],
        },
        limit: 500,
        depth: 0,
        select: { couponApplied: true },
        overrideAccess: false,
        user,
      }),
      payload.count({
        collection: 'bookings',
        where: {
          and: [
            { guest: { equals: user!.id } },
            { status: { in: [...BOOKING_ACTIVE_STATUSES, 'checked_out'] } },
          ],
        },
        overrideAccess: false,
        user,
      }),
    ])

  const usageByCoupon = new Map<string, number>()
  for (const booking of couponedBookings) {
    const id = relationId(booking.couponApplied)
    if (id) usageByCoupon.set(id, (usageByCoupon.get(id) ?? 0) + 1)
  }

  const isFirstBooking = countedStays === 0

  const withStatus = coupons.map((coupon) => {
    const timesUsed = usageByCoupon.get(String(coupon.id)) ?? 0
    return { coupon, timesUsed, blocked: blockedReason(coupon, timesUsed, isFirstBooking) }
  })

  const available = withStatus.filter((entry) => entry.blocked === null)
  const unavailable = withStatus.filter((entry) => entry.blocked !== null)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">My offers</h1>
        <p className="text-sm text-muted-foreground">
          Coupons you can use right now, plus the ones you have already claimed. Enter the code at
          checkout — the final discount is confirmed against your booking.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Available to you{available.length > 0 ? ` (${available.length})` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {available.length === 0 ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">
                No offers are open to you at the moment — new codes are published on the offers
                page.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/offers">Browse all offers</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {available.map(({ coupon, timesUsed }) => (
                <div key={coupon.id} className="space-y-3 rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-mono text-lg font-bold">{coupon.code}</p>
                    <Badge variant="outline" className="shrink-0 bg-green-100 text-green-800">
                      Ready to use
                    </Badge>
                  </div>

                  <p className="text-sm font-semibold">{discountLabel(coupon)}</p>

                  {coupon.description ? (
                    <p className="text-sm text-muted-foreground">{coupon.description}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{scopeLabel(coupon)}</Badge>
                    {coupon.minBookingAmount ? (
                      <Badge variant="outline">
                        Min spend ৳{coupon.minBookingAmount.toLocaleString('en-US')}
                      </Badge>
                    ) : null}
                    {coupon.discountType === 'percent' && coupon.maxDiscountAmount ? (
                      <Badge variant="outline">
                        Up to ৳{coupon.maxDiscountAmount.toLocaleString('en-US')}
                      </Badge>
                    ) : null}
                    {coupon.firstBookingOnly ? <Badge variant="outline">First booking</Badge> : null}
                    {coupon.validUntil ? (
                      <Badge variant="outline">
                        Until{' '}
                        {new Date(coupon.validUntil).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Badge>
                    ) : null}
                    {timesUsed > 0 ? (
                      <Badge variant="outline">
                        Used {timesUsed}
                        {coupon.usesPerUser ? `/${coupon.usesPerUser}` : ''}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {unavailable.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Used &amp; unavailable</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {unavailable.map(({ coupon, blocked }) => (
                <li key={coupon.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-mono text-sm font-semibold text-muted-foreground">
                      {coupon.code}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {discountLabel(coupon)} · {scopeLabel(coupon)}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 bg-slate-100 text-slate-600">
                    {blocked}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

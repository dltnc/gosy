import type { Metadata } from 'next'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Offers',
  description: 'Active coupon codes and promotional offers.',
}

export const revalidate = 60

export default async function OffersPage() {
  const payload = await getPayloadClient()
  const { docs: coupons } = await payload
    .find({
      collection: 'coupons',
      where: { active: { equals: true } },
      sort: '-createdAt',
      limit: 20,
      depth: 0,
    })
    .catch(() => ({ docs: [] }))

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Offers</h1>
        <p className="text-sm text-muted-foreground">
          Apply these codes at checkout. Terms and availability limits apply.
        </p>
      </header>

      {coupons.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No active offers right now — check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardHeader>
                <CardTitle className="font-mono text-lg">{coupon.code}</CardTitle>
                {coupon.description ? (
                  <p className="text-sm text-muted-foreground">{coupon.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">
                  {coupon.discountType === 'percent'
                    ? `${coupon.discountValue}% off`
                    : `৳${coupon.discountValue.toLocaleString('en-US')} off`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {coupon.minBookingAmount ? (
                    <Badge variant="outline">Min spend ৳{coupon.minBookingAmount.toLocaleString('en-US')}</Badge>
                  ) : null}
                  {coupon.firstBookingOnly ? <Badge variant="outline">First booking only</Badge> : null}
                  {coupon.usageLimitTotal ? (
                    <Badge variant="outline">Limited to {coupon.usageLimitTotal} uses</Badge>
                  ) : null}
                  {coupon.validUntil ? (
                    <Badge variant="outline">Until {new Date(coupon.validUntil).toLocaleDateString('en-GB')}</Badge>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

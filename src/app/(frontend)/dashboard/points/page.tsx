import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Loyalty points',
}

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  earn: { label: 'Earned', className: 'bg-green-100 text-green-800' },
  redeem: { label: 'Redeemed', className: 'bg-blue-100 text-blue-800' },
  expire: { label: 'Expired', className: 'bg-slate-100 text-slate-600' },
  reverse: { label: 'Reversed', className: 'bg-red-100 text-red-700' },
  adjust: { label: 'Adjusted', className: 'bg-amber-100 text-amber-800' },
}

export default async function PointsPage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const [{ docs: ledger }, settings] = await Promise.all([
    payload.find({
      collection: 'loyalty-points',
      where: { user: { equals: user!.id } },
      sort: '-createdAt',
      limit: 100,
      depth: 1,
      overrideAccess: false,
      user,
    }),
    payload.findGlobal({ slug: 'platform-settings', depth: 0 }),
  ])

  const loyalty = settings.loyaltyProgram

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Loyalty points</h1>
        <p className="text-sm text-muted-foreground">
          Earn points when you check out, spend them on future stays.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current balance</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {(user!.pointsBalance ?? 0).toLocaleString('en-US')}
            <span className="ml-1 text-sm font-normal text-muted-foreground">points</span>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p>
              Earn <strong className="text-foreground">{loyalty?.earnRatePer100Spent ?? 1}</strong>{' '}
              point{loyalty?.earnRatePer100Spent === 1 ? '' : 's'} per{' '}
              {settings.currency ?? 'BDT'} 100 spent — posted automatically when you check out.
            </p>
            <p>
              Points are worth{' '}
              <strong className="text-foreground">{settings.currency ?? 'BDT'} {loyalty?.redeemRate ?? 0}</strong>{' '}
              each when redeemed, up to{' '}
              <strong className="text-foreground">{loyalty?.maxRedeemPercentOfBooking ?? 0}%</strong> of
              a booking.
            </p>
            <p>
              Minimum redemption: {loyalty?.minRedeemPoints ?? 0} points · earned points expire
              after {loyalty?.pointsExpireAfterDays ?? 365} days.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Points history</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No points activity yet — points appear here after your first completed stay.
            </p>
          ) : (
            <ul className="divide-y">
              {ledger.map((entry) => {
                const meta = TYPE_LABELS[entry.type] ?? TYPE_LABELS.adjust
                const bookingRef =
                  typeof entry.sourceBooking === 'object' && entry.sourceBooking !== null
                    ? entry.sourceBooking.bookingRef
                    : null

                return (
                  <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                        {bookingRef ? (
                          <span className="font-mono text-xs text-muted-foreground">{bookingRef}</span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.notes ?? ''}{' '}
                        {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-bold tabular-nums ${
                        entry.amount > 0 ? 'text-green-600' : 'text-muted-foreground'
                      }`}
                    >
                      {entry.amount > 0 ? '+' : ''}
                      {entry.amount.toLocaleString('en-US')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

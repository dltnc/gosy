import type { Metadata } from 'next'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PayoutProfileForm } from '@/features/partner/components/payout-profile-form'
import { PayoutRequestForm } from '@/features/partner/components/payout-request-form'
import type { PayoutMethod } from '@/features/partner/api'
import { requirePartner } from '@/features/partner/guard'
import { getPartnerPayoutSummary } from '@/lib/payouts/earnings'

export const metadata: Metadata = {
  title: 'Payouts',
}

const STATUS_STYLES: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  processing: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
}

const METHOD_LABELS: Record<string, string> = {
  bkash: 'bKash',
  nagad: 'Nagad',
  bank: 'Bank transfer',
}

function money(amount: number): string {
  return `৳${amount.toLocaleString('en-US')}`
}

function day(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('en-GB') : '—'
}

export default async function PartnerPayoutsPage() {
  const { payload, user } = await requirePartner('/partner/payouts')

  // Scoped to the signed-in account on purpose, admins included: this page answers "what am I owed",
  // and an admin processing other people's requests does that in the admin panel where the audit
  // trail and the status transitions live.
  const [summary, { docs: payouts }] = await Promise.all([
    getPartnerPayoutSummary(payload, user.id),
    payload.find({
      collection: 'payouts',
      where: { partner: { equals: user.id } },
      sort: '-requestedAt',
      limit: 50,
      depth: 0,
      overrideAccess: false,
      user,
    }),
  ])

  const profile = user.partnerProfile ?? {}
  const bank = profile.bankDetails ?? {}
  const method = (profile.payoutMethod ?? null) as PayoutMethod | null
  const savedAccount = method === 'bank' ? bank.accountNumber : profile.payoutAccountNumber
  const canRequest = Boolean(method) && Boolean(savedAccount)

  const stats = [
    { label: 'Lifetime earnings', value: money(summary.lifetimeEarned), muted: true },
    { label: 'Paid out', value: money(summary.paidOut), muted: true },
    { label: 'Pending requests', value: money(summary.pending), muted: true },
    { label: 'Available now', value: money(summary.available), muted: false },
  ]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          Your earnings are net of commission and released once a guest checks out. Request a
          transfer whenever there is a balance available.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={
              stat.muted
                ? 'rounded-xl border border-outline bg-card p-4'
                : 'rounded-xl border-2 border-primary-container bg-primary-fixed p-4'
            }
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-xl font-extrabold text-primary">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PayoutRequestForm available={summary.available} canRequest={canRequest} />
        <PayoutProfileForm
          userId={Number(user.id)}
          initial={{
            payoutMethod: method,
            payoutAccountNumber: profile.payoutAccountNumber ?? '',
            bankDetails: {
              bankName: bank.bankName ?? '',
              accountName: bank.accountName ?? '',
              accountNumber: bank.accountNumber ?? '',
              branchName: bank.branchName ?? '',
              routingNumber: bank.routingNumber ?? '',
            },
          }}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-primary">Payout history</h2>
        {payouts.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">No payouts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Once a stay is completed its payout lands in your available balance. Track completed
              stays on your{' '}
              <Link href="/partner/bookings" className="underline underline-offset-4">
                bookings page
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {payouts.map((payout) => (
              <Card key={payout.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-bold">{money(payout.amount ?? 0)}</span>
                      <Badge
                        variant="outline"
                        className={`capitalize ${STATUS_STYLES[payout.status ?? ''] ?? ''}`}
                      >
                        {payout.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {METHOD_LABELS[payout.method ?? ''] ?? payout.method}
                        {payout.destination?.accountNumber
                          ? ` · ${payout.destination.accountNumber}`
                          : ''}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Requested {day(payout.requestedAt)}
                      {payout.status === 'paid' ? ` · paid ${day(payout.paidAt)}` : ''}
                      {payout.reference ? ` · ref ${payout.reference}` : ''}
                    </p>
                    {payout.status === 'rejected' && payout.adminNotes ? (
                      <p className="text-sm text-destructive">{payout.adminNotes}</p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

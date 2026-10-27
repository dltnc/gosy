import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import { Mail, MessageSquareText } from 'lucide-react'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Notifications',
}

interface NotificationItem {
  id: string
  channel: 'sms' | 'email'
  title: string
  body: string
  status?: string | null
  createdAt: string
}

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  sent: 'bg-blue-100 text-blue-800',
  bounced: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
  complained: 'bg-orange-100 text-orange-700',
  pending: 'bg-amber-100 text-amber-800',
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function NotificationsPage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const [{ docs: sms }, { docs: emails }] = await Promise.all([
    payload
      .find({
        collection: 'sms-logs',
        where: {
          or: [
            { 'relatedBooking.guest': { equals: user!.id } },
            { phone: { equals: user!.phone ?? '__unmatched__' } },
          ],
        },
        sort: '-createdAt',
        limit: 25,
        depth: 0,
        overrideAccess: false,
        user,
      })
      .catch(() => ({ docs: [] })),
    payload
      .find({
        collection: 'email-logs',
        where: {
          or: [
            { 'relatedBooking.guest': { equals: user!.id } },
            { to: { equals: user!.email } },
          ],
        },
        sort: '-createdAt',
        limit: 25,
        depth: 0,
        overrideAccess: false,
        user,
      })
      .catch(() => ({ docs: [] })),
  ])

  const items: NotificationItem[] = [
    ...sms.map((row) => ({
      id: `sms-${row.id}`,
      channel: 'sms' as const,
      title: `SMS · ${row.purpose.replace(/_/g, ' ')}`,
      body: row.message,
      status: row.deliveryStatus,
      createdAt: row.createdAt,
    })),
    ...emails.map((row) => ({
      id: `email-${row.id}`,
      channel: 'email' as const,
      title: row.subject,
      body: row.template ? `${row.template}` : 'Email notification',
      status: row.status,
      createdAt: row.createdAt,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          SMS and email updates about your bookings and payments.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nothing here yet — booking confirmations and payment receipts will show up in this list.
        </div>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {items.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-4">
                <span className="mt-0.5 rounded-lg bg-muted p-2">
                  {item.channel === 'sms' ? (
                    <MessageSquareText className="size-4" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.status ? (
                      <Badge
                        variant="outline"
                        className={`capitalize ${STATUS_STYLES[item.status] ?? ''}`}
                      >
                        {item.status}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{item.body}</p>
                  <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
                    {timeAgo(item.createdAt)}
                  </time>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

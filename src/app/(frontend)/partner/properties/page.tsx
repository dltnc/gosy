import type { Metadata } from 'next'
import Link from 'next/link'

import { requirePartner } from '@/features/partner/guard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Properties',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-red-100 text-red-700',
}

export default async function PartnerPropertiesPage() {
  const { payload, user, isAdmin } = await requirePartner('/partner/properties')

  const { docs: properties } = await payload.find({
    collection: 'properties',
    ...(isAdmin ? {} : { where: { partner: { equals: user.id } } }),
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: false,
    user,
  })

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground">Your listings and their review status.</p>
        </div>
        <Button asChild>
          <Link href="/partner/properties/new">New property</Link>
        </Button>
      </header>

      {properties.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No properties yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first listing to start receiving bookings.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {properties.map((property) => (
            <Card key={property.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/partner/properties/${property.id}`}
                      className="truncate font-medium hover:underline"
                    >
                      {property.name}
                    </Link>
                    <Badge
                      variant="outline"
                      className={`capitalize ${STATUS_STYLES[property.status ?? ''] ?? ''}`}
                    >
                      {property.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[property.address?.area, property.address?.city].filter(Boolean).join(', ') ||
                      'Location not set'}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/partner/properties/${property.id}`}>Manage</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'

import { WishlistGrid } from '@/features/dashboard/components/wishlist-grid'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { getPropertySearchDocumentsByIds } from '@/lib/search/searchProperties'

export const metadata: Metadata = {
  title: 'Wishlist',
}

export default async function WishlistPage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const { docs: entries } = await payload.find({
    collection: 'wishlist',
    where: { guest: { equals: user!.id } },
    sort: '-createdAt',
    limit: 100,
    depth: 0,
    overrideAccess: false,
    user,
  })

  let properties: Awaited<ReturnType<typeof getPropertySearchDocumentsByIds>> = []
  try {
    properties = await getPropertySearchDocumentsByIds(
      payload,
      entries.map((entry) => Number(entry.property)),
    )
  } catch {
    properties = []
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Wishlist</h1>
        <p className="text-sm text-muted-foreground">
          Stays you&apos;ve saved for a future trip.
        </p>
      </header>

      <WishlistGrid properties={properties} />
    </div>
  )
}

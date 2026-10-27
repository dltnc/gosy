'use client'

import { useState } from 'react'
import Link from 'next/link'

import type { PropertySearchDocument } from '@/lib/search/searchProperties'
import { PropertyCard } from '@/features/search/components/property-card'

export function WishlistGrid({ properties }: { properties: PropertySearchDocument[] }) {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(() => new Set())
  const visible = properties.filter((property) => !removedIds.has(String(property.id)))

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="font-medium">Your wishlist is empty.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the heart on any stay to save it here for later.
        </p>
        <Link
          href="/hotels-in/Dhaka"
          className="mt-3 inline-block text-sm underline underline-offset-4"
        >
          Explore stays
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      {visible.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          wishlisted
          onWishlistedChange={(next) => {
            if (!next) {
              setRemovedIds((prev) => new Set(prev).add(String(property.id)))
            }
          }}
        />
      ))}
    </div>
  )
}

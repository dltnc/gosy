import Image from 'next/image'
import Link from 'next/link'
import { MapPin } from 'lucide-react'

import type { PropertySearchDocument } from '@/lib/search/searchProperties'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { WishlistButton } from './wishlist-button'
import { cn } from '@/lib/utils'

export function ratingLabel(rating: number): string {
  if (rating >= 4.5) return 'Exceptional'
  if (rating >= 4) return 'Very good'
  if (rating >= 3.5) return 'Good'
  if (rating > 0) return 'Pleasant'
  return 'New'
}

export function RatingChip({ rating, className }: { rating: number; className?: string }) {
  if (rating <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-primary px-1.5 py-0.5 text-sm font-bold text-white',
        className,
      )}
      aria-label={`Rated ${rating.toFixed(1)} out of 5 — ${ratingLabel(rating)}`}
    >
      {rating.toFixed(1)}
    </span>
  )
}

function cardBadge(property: PropertySearchDocument) {
  if (property.isFeatured || property.tier === 'flagship') {
    return { label: 'Featured Deal', className: 'bg-secondary text-white' }
  }
  if (property.avgRating >= 4.5) {
    return { label: 'Popular choice', className: 'bg-primary text-white' }
  }
  if (property.trustBadges?.includes('new_listing')) {
    return { label: 'New', className: 'bg-tertiary text-white' }
  }
  return null
}

interface PropertyCardProps {
  property: PropertySearchDocument
  wishlisted?: boolean
  onWishlistedChange?: (wishlisted: boolean) => void
  /**
   * Renders the paid-placement disclosure instead of whatever `cardBadge` would have chosen. It is a
   * separate prop rather than another branch inside `cardBadge` because a sponsored card has to say
   * "Sponsored" even when it also happens to be a popular choice — the label is a disclosure, not a
   * marketing flourish, so it cannot lose a tie-break.
   */
  sponsored?: boolean
}

export function PropertyCard({
  property,
  wishlisted,
  onWishlistedChange,
  sponsored,
}: PropertyCardProps) {
  const image = property.heroImageUrl
  const location = [property.localityName, property.city].filter(Boolean).join(', ')
  const badge = sponsored
    ? { label: 'Sponsored', className: 'bg-primary text-white' }
    : cardBadge(property)
  const detailHref = `/property/${property.slug}`

  return (
    <article className="group flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <Link href={detailHref} aria-label={property.name}>
          {image ? (
            <Image
              src={image}
              alt={property.name}
              fill
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-container to-primary">
              <span className="text-4xl font-extrabold text-white/90" aria-hidden>
                {property.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </Link>
        {badge ? (
          <Badge
            className={`absolute top-3 left-3 border-none uppercase tracking-wide ${badge.className}`}
          >
            {badge.label}
          </Badge>
        ) : null}
        <div className="absolute top-3 right-3">
          <WishlistButton
            propertyId={Number(property.id)}
            propertyName={property.name}
            initial={wishlisted}
            onToggled={onWishlistedChange}
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={detailHref}
            className="line-clamp-1 text-lg font-bold text-primary hover:underline"
          >
            {property.name}
          </Link>
          <RatingChip rating={property.avgRating} className="shrink-0" />
        </div>

        <p className="flex items-center gap-1 text-body-md text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {location || 'Bangladesh'}
        </p>

        {(property.amenityNames?.length ?? 0) > 0 ||
        property.trustBadges?.includes('free_cancellation') ||
        property.trustBadges?.includes('breakfast_included') ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {property.trustBadges?.includes('free_cancellation') ? (
              <Badge variant="success" className="rounded-md font-medium">
                Free Cancellation
              </Badge>
            ) : null}
            {property.trustBadges?.includes('breakfast_included') ? (
              <Badge variant="success" className="rounded-md font-medium">
                Free Breakfast
              </Badge>
            ) : null}
            {property.amenityNames?.slice(0, 3).map((name) => (
              <Badge key={name} variant="muted" className="rounded-md font-normal">
                {name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
          <div>
            {property.priceFrom > 0 ? (
              <div className="flex items-baseline gap-1.5">
                {property.compareAtPriceFrom ? (
                  <span className="text-sm text-muted-foreground line-through">
                    ৳{property.compareAtPriceFrom.toLocaleString('en-US')}
                  </span>
                ) : null}
                <span className="text-xl font-extrabold text-secondary">
                  ৳{property.priceFrom.toLocaleString('en-US')}
                </span>
                <span className="text-body-md text-muted-foreground">per night</span>
              </div>
            ) : (
              <span className="text-body-md text-muted-foreground">See rates & availability</span>
            )}
          </div>
          <Button asChild variant="outline" size="sm" className="h-9 px-4">
            <Link href={detailHref}>View Details</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

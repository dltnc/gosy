import Image from 'next/image'
import Link from 'next/link'
import { MapPin } from 'lucide-react'

import type { PropertySearchDocument } from '@/lib/search/searchProperties'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RatingChip, ratingLabel } from './property-card'

export function FeaturedCard({
  property,
  label = 'Featured Deal',
}: {
  property: PropertySearchDocument
  /** Overridden to "Sponsored" in the spotlight band, where the placement is paid for. */
  label?: string
}) {
  const image = property.heroImageUrl
  const location = [property.localityName, property.city].filter(Boolean).join(', ')
  const detailHref = `/property/${property.slug}`

  return (
    <article className="group grid overflow-hidden rounded-xl border border-border bg-card shadow-card transition-all hover:shadow-lift md:grid-cols-[minmax(0,420px)_1fr]">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted md:aspect-auto md:min-h-[280px]">
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
        <Badge className="absolute top-3 left-3 border-none uppercase tracking-wide">{label}</Badge>
      </div>

      <div className="flex flex-col gap-3 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <Link
              href={detailHref}
              className="line-clamp-1 text-xl font-bold text-primary hover:underline md:text-2xl"
            >
              {property.name}
            </Link>
            <p className="flex items-center gap-1 text-body-md text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {location || 'Bangladesh'}
            </p>
          </div>
          {property.priceFrom > 0 ? (
            <div className="text-right">
              {property.compareAtPriceFrom ? (
                <p className="text-sm text-muted-foreground line-through">
                  ৳{property.compareAtPriceFrom.toLocaleString('en-US')}
                </p>
              ) : null}
              <p className="text-2xl font-extrabold text-secondary">
                ৳{property.priceFrom.toLocaleString('en-US')}
                <span className="ml-1 text-sm font-normal text-muted-foreground">per night</span>
              </p>
            </div>
          ) : null}
        </div>

        {(property.amenityNames?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {property.amenityNames?.slice(0, 4).map((name) => (
              <Badge key={name} variant="muted" className="rounded-md font-normal">
                {name}
              </Badge>
            ))}
          </div>
        ) : null}

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
          {property.starRating ? (
            <Badge variant="outline" className="rounded-md font-normal">
              {property.starRating}-star
            </Badge>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <RatingChip rating={property.avgRating} />
            <span className="text-sm font-semibold">{ratingLabel(property.avgRating)}</span>
          </div>
          <Button asChild variant="cta">
            <Link href={detailHref}>View Details</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

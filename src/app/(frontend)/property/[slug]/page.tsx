import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Car,
  Check,
  ChevronRight,
  Coffee,
  Dumbbell,
  MapPin,
  Martini,
  Snowflake,
  Sparkles,
  Star,
  Umbrella,
  UtensilsCrossed,
  Waves,
  Wifi,
  type LucideIcon,
} from 'lucide-react'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { parseYouTubeId } from '@/lib/media/youtube'
import { richTextToPlainText } from '@/lib/richtext'
import { PROPERTY_TYPE_LABELS, type PropertyTypeValue } from '@/lib/search/searchProperties'
import { BookingWidget } from '@/features/property/components/booking-widget'
import { PropertyMediaGallery } from '@/features/property/components/property-media-gallery'
import { ReserveRoomButton } from '@/features/property/components/reserve-room-button'
import { RoomSelectionProvider } from '@/features/property/components/room-selection-provider'
import { decodeRoomSelection } from '@/lib/bookings/constants'
import { ReviewsList } from '@/features/reviews/components/reviews-list'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

interface PropertyPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function getProperty(slug: string) {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'properties',
    where: {
      and: [{ slug: { equals: slug } }, { status: { equals: 'approved' } }],
    },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

export async function generateMetadata({ params }: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params
  const property = await getProperty(slug).catch(() => null)
  if (!property) return { title: 'Property not found' }
  return {
    title: property.name,
    description: `Book a stay at ${property.name} in ${property.address?.city ?? 'Bangladesh'}.`,
    alternates: { canonical: `/property/${slug}` },
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const AMENITY_ICONS: [RegExp, LucideIcon][] = [
  [/wifi|internet/i, Wifi],
  [/pool|swim/i, Waves],
  [/gym|fitness/i, Dumbbell],
  [/restaurant|dining|food/i, UtensilsCrossed],
  [/bar|lounge/i, Martini],
  [/spa|sauna|massage|wellness/i, Sparkles],
  [/air.?cond|\bac\b|cooling/i, Snowflake],
  [/park/i, Car],
  [/breakfast/i, Coffee],
  [/beach/i, Umbrella],
]

function amenityIcon(name: string): LucideIcon {
  for (const [pattern, Icon] of AMENITY_ICONS) {
    if (pattern.test(name)) return Icon
  }
  return Check
}

export default async function PropertyPage({ params, searchParams }: PropertyPageProps) {
  const [{ slug }, rawSearch] = await Promise.all([params, searchParams])
  const property = await getProperty(slug)

  if (!property) notFound()

  const payload = await getPayloadClient()
  const [{ docs: roomTypes }, { docs: activeRooms }, { docs: propertyReviews }] = await Promise.all(
    [
      payload.find({
        collection: 'room-types',
        where: {
          and: [{ property: { equals: property.id } }, { isActive: { equals: true } }],
        },
        sort: 'basePrice',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'rooms',
        where: {
          and: [{ property: { equals: property.id } }, { isActive: { equals: true } }],
        },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'reviews',
        where: { property: { equals: property.id } },
        sort: '-createdAt',
        limit: 10,
        depth: 1,
        select: {
          rating: true,
          title: true,
          comment: true,
          partnerReply: true,
          createdAt: true,
          guest: true,
        },
      }),
    ],
  )

  // A room type is only listed while at least one physical room of it is bookable.
  const activeRoomTypeIds = new Set(
    activeRooms.map((room) =>
      Number(typeof room.roomType === 'object' ? room.roomType.id : room.roomType),
    ),
  )
  const bookableRoomTypes = roomTypes.filter((roomType) => activeRoomTypeIds.has(roomType.id))

  const checkIn = firstParam(rawSearch.checkIn)
  const checkOut = firstParam(rawSearch.checkOut)
  const adults = Math.max(Number(firstParam(rawSearch.adults) ?? '2') || 2, 1)
  const children = Math.max(Number(firstParam(rawSearch.children) ?? '0') || 0, 0)

  // `?rooms=12:2,15:1` makes a selection linkable — a guest can share a two-room stay, and the
  // checkout page can send them back here with what they had.
  const initialSelection = [...decodeRoomSelection(firstParam(rawSearch.rooms))].filter(
    ([roomTypeId]) => activeRoomTypeIds.has(roomTypeId),
  )

  const amenityNames = (property.amenities ?? []).flatMap((a) =>
    typeof a === 'object' && a !== null ? [a.name] : [],
  )

  const galleryImages = property.images?.length
    ? property.images
    : property.heroImage && typeof property.heroImage === 'object'
      ? [{ image: property.heroImage, caption: null }]
      : []

  const galleryPhotos = galleryImages.flatMap((entry) =>
    typeof entry.image === 'object' && entry.image?.url
      ? [{ url: entry.image.url, caption: entry.caption }]
      : [],
  )

  // Parsed server-side so the client component never sees a raw partner-supplied URL: it receives an
  // id that has already been checked against the YouTube host and charset rules.
  const galleryVideos = (property.videos ?? []).flatMap((entry) => {
    const id = parseYouTubeId(entry.url)
    return id ? [{ id, title: entry.title }] : []
  })

  const city = property.address?.city ?? ''
  const propertyType: PropertyTypeValue = property.propertyType === 'resort' ? 'resort' : 'hotel'
  const typeLabel = PROPERTY_TYPE_LABELS[propertyType]
  const listingHref = `/${propertyType}s-in/${encodeURIComponent(city)}`
  const description = richTextToPlainText(property.description)

  const widgetRoomTypes = bookableRoomTypes.map((roomType) => ({
    id: roomType.id,
    name: roomType.name,
    basePrice: roomType.basePrice,
    maxOccupancy: roomType.maxOccupancy,
  }))

  const addressLine = [
    property.address?.streetAddress,
    property.address?.area,
    city,
    property.address?.postcode,
  ]
    .filter(Boolean)
    .join(', ')

  const directionsHref =
    property.location && property.location.length === 2
      ? `https://www.google.com/maps/search/?api=1&query=${property.location[1]},${property.location[0]}`
      : addressLine
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}`
        : null

  return (
    <RoomSelectionProvider
      roomTypes={widgetRoomTypes}
      initialSelection={initialSelection}
      initialCheckIn={checkIn}
      initialCheckOut={checkOut}
      initialAdults={adults}
      initialChildren={children}
    >
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/" className="hover:text-foreground hover:underline">
            Home
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <Link href={listingHref} className="hover:text-foreground hover:underline">
            {typeLabel} in {city || 'Bangladesh'}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span aria-current="page" className="truncate font-medium text-foreground">
            {property.name}
          </span>
        </nav>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{property.name}</h1>
            <Badge>{propertyType === 'resort' ? 'Resort' : 'Hotel'}</Badge>
            {(property.trustBadges ?? []).includes('platform_serviced') ? (
              <Badge variant="success">Platform-serviced</Badge>
            ) : null}
            {(property.trustBadges ?? []).includes('new_listing') ? (
              <Badge variant="outline">New listing</Badge>
            ) : null}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="size-4" aria-hidden />
              {[property.address?.area, city].filter(Boolean).join(', ') || 'Bangladesh'}
            </span>
            {property.starRating ? (
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-yellow-400 text-yellow-400" aria-hidden />
                {property.starRating}-star
              </span>
            ) : null}
            {(property.reviewCount ?? 0) > 0 ? (
              <span className="flex items-center gap-1">
                <Star className="size-4 fill-secondary text-secondary" aria-hidden />
                {(property.avgRating ?? 0).toFixed(1)} · {property.reviewCount} review
                {property.reviewCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </p>
        </header>

        <PropertyMediaGallery
          photos={galleryPhotos}
          videos={galleryVideos}
          propertyName={property.name}
        />

        <div className="lg:hidden">
          <BookingWidget currency="৳" />
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
          <div className="space-y-10">
            {description ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">About this property</h2>
                <div className="space-y-3 text-body-md text-muted-foreground">
                  {description.split(/\n+/).map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ) : null}

            {amenityNames.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Property amenities</h2>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {amenityNames.map((name) => {
                    const Icon = amenityIcon(name)
                    return (
                      <li
                        key={name}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                      >
                        <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                        {name}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}

            <section id="rooms" className="scroll-mt-24 space-y-4">
              <h2 className="text-lg font-semibold">Available accommodations</h2>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {bookableRoomTypes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {roomTypes.length > 0
                      ? 'All rooms are currently unavailable for this property. Please check back soon.'
                      : 'Rooms for this property are being updated. Check back soon.'}
                  </p>
                ) : (
                  bookableRoomTypes.map((roomType) => (
                    <Card key={roomType.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <CardTitle className="text-base">{roomType.name}</CardTitle>
                          <div className="text-right">
                            <p className="text-price-display">
                              ৳{roomType.basePrice.toLocaleString('en-US')}
                            </p>
                            <p className="text-xs text-muted-foreground">per night</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {roomType.description ? (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {roomType.description}
                          </p>
                        ) : null}
                        <Separator />
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                          <span>
                            Sleeps {roomType.maxOccupancy ?? 2}
                            {roomType.bedConfiguration ? ` · ${roomType.bedConfiguration}` : ''}
                            {roomType.sizeSqft ? ` · ${roomType.sizeSqft} sqft` : ''}
                          </span>
                          <ReserveRoomButton
                            roomTypeId={roomType.id}
                            roomTypeName={roomType.name}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>

            {property.policies?.cancellationPolicy || property.policies?.checkInTime ? (
              <section className="space-y-2 rounded-xl border p-5 text-sm">
                <h2 className="text-lg font-semibold">Policies</h2>
                <p className="text-muted-foreground">
                  Check-in from {property.policies?.checkInTime ?? '14:00'} · Check-out until{' '}
                  {property.policies?.checkOutTime ?? '12:00'}
                </p>
                {property.policies?.cancellationPolicy ? (
                  <p className="text-muted-foreground">{property.policies.cancellationPolicy}</p>
                ) : null}
              </section>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Guest reviews</h2>
              </div>
              <ReviewsList reviews={propertyReviews} />
            </section>

            {addressLine ? (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Location</h2>
                <p className="flex items-start gap-2 text-body-md text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {addressLine}
                </p>
                {directionsHref ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={directionsHref} target="_blank" rel="noopener noreferrer">
                      <MapPin className="size-4" aria-hidden />
                      Get directions
                    </a>
                  </Button>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <BookingWidget currency="৳" />
            </div>
          </aside>
        </div>
      </div>
    </RoomSelectionProvider>
  )
}

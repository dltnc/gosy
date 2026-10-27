import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { BadgePercent, Headset, ShieldCheck, Sparkles, Star, Wallet } from 'lucide-react'

import { SearchBar } from '@/features/search/components/search-bar'
import { PropertyCard } from '@/features/search/components/property-card'
import type { PropertySearchDocument } from '@/lib/search/searchProperties'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { SectionHeading } from '@/components/shared/section-heading'
import { DestinationCard } from '@/components/shared/destination-card'
import { Button } from '@/components/ui/button'

const DESTINATIONS = [
  {
    title: "Cox's Bazar",
    description:
      "The world's longest natural sea beach — 120km of golden sand, sunset and fresh seafood.",
    image: '/images/dest-coxsbazar.jpg',
    city: "Cox's Bazar",
    span: 'md:col-span-8',
    large: true,
  },
  {
    title: 'Sylhet',
    description: 'Tea gardens, Ratargul swamp forest and the hills of Jaflong.',
    image: '/images/dest-sylhet.jpg',
    city: 'Sylhet',
    span: 'md:col-span-4',
  },
  {
    title: "Saint Martin's Island",
    description: 'Coral waters and laid-back island life in the Bay of Bengal.',
    image: '/images/dest-saintmartin.jpg',
    city: "Saint Martin's Island",
    span: 'md:col-span-4',
  },
  {
    title: 'Bandarban',
    description: 'Hill tracts, cloud-kissed peaks and Chimbuk marma villages.',
    image: '/images/dest-bandarban.jpg',
    city: 'Bandarban',
    span: 'md:col-span-4',
  },
  {
    title: 'Dhaka',
    description: 'The vibrant capital — business hotels, heritage and street food.',
    image: '/images/dest-dhaka.jpg',
    city: 'Dhaka',
    span: 'md:col-span-4',
  },
]

const VALUE_PROPS = [
  {
    Icon: ShieldCheck,
    tile: 'bg-primary-container text-on-primary-container',
    title: 'Trusted Reliability',
    copy: 'Every property is verified by our team before it goes live, so what you see is what you get.',
  },
  {
    Icon: BadgePercent,
    tile: 'bg-secondary text-white',
    title: 'Best Price Guarantee',
    copy: 'Find a lower rate elsewhere? We match it — and coupon deals drop prices even further.',
  },
  {
    Icon: Headset,
    tile: 'bg-tertiary-container text-on-tertiary-container',
    title: 'Local Support, 24/7',
    copy: 'Real humans in your timezone, on phone and email — before, during and after your stay.',
  },
]

export const metadata: Metadata = {
  title: 'StayBD — Hotels & Resorts in Bangladesh',
}

export const revalidate = 60

async function getFeaturedProperties(): Promise<PropertySearchDocument[]> {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'properties',
    where: { status: { equals: 'approved' } },
    sort: '-featuredPriority',
    limit: 6,
    depth: 1,
    overrideAccess: true,
  })

  const base = docs.map((property) => ({
    id: String(property.id),
    numericId: Number(property.id),
    name: property.name,
    slug: property.slug,
    city: property.address?.city ?? '',
    localityName:
      typeof property.locality === 'object' && property.locality !== null
        ? property.locality.name
        : undefined,
    propertyType:
      property.propertyType === 'resort'
        ? ('resort' as const)
        : ('hotel' as const),
    tier: property.tier ?? 'standard',
    starRating: property.starRating ?? undefined,
    avgRating: property.avgRating ?? 0,
    isFeatured: Boolean(property.isFeatured),
    featuredPriority: property.featuredPriority ?? 0,
    trustBadges: property.trustBadges ?? [],
    heroImageUrl:
      typeof property.heroImage === 'object' && property.heroImage !== null
        ? (property.heroImage.url ?? undefined)
        : undefined,
    indexedAt: Date.now(),
  }))

  if (base.length === 0) return []

  try {
    const { docs: roomTypes } = await payload.find({
      collection: 'room-types',
      where: {
        and: [
          { property: { in: base.map((p) => p.numericId) } },
          { isActive: { equals: true } },
        ],
      },
      sort: 'basePrice',
      limit: 300,
      depth: 0,
      overrideAccess: true,
    })

    const minByProperty = new Map<string, number>()
    for (const room of roomTypes) {
      const key = String(room.property)
      const price = room.basePrice ?? 0
      if (price > 0 && (!minByProperty.has(key) || price < minByProperty.get(key)!)) {
        minByProperty.set(key, price)
      }
    }

    return base.map(({ numericId: _numericId, ...rest }) => ({
      ...rest,
      priceFrom: minByProperty.get(String(_numericId)) ?? 0,
    }))
  } catch {
    return base.map(({ numericId: _numericId, ...rest }) => ({ ...rest, priceFrom: 0 }))
  }
}

export default async function HomePage() {
  const featured = await getFeaturedProperties().catch(() => [])

  return (
    <>
      {/* Hero + floating search */}
      <section className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden px-gutter py-20">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-beach.jpg"
            alt="Traditional fishing boats on the beach of Cox's Bazar at sunrise"
            fill
            preload
            sizes="100vw"
            className="object-cover brightness-75"
          />
        </div>
        <div className="relative z-10 mb-10 w-full max-w-site text-center">
          <h1 className="mb-4 text-3xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-4xl md:text-display-lg">
            Find your perfect stay across Bangladesh
          </h1>
          <p className="mx-auto max-w-2xl text-headline-md text-white/90 drop-shadow">
            Reliable bookings, exclusive deals, and unforgettable experiences.
          </p>
        </div>
        <div className="relative z-10 w-full max-w-5xl">
          <SearchBar />
        </div>
      </section>

      {/* Trending destinations — bento grid */}
      <section className="mx-auto max-w-site px-gutter py-20">
        <SectionHeading eyebrow="Explore" title="Top Trending Destinations" />
        <div className="grid grid-cols-1 gap-6 md:h-[700px] md:grid-cols-12 md:grid-rows-2">
          {DESTINATIONS.map((destination) => (
            <div key={destination.city} className={destination.span}>
              <DestinationCard
                title={destination.title}
                description={destination.description}
                imageSrc={destination.image}
                href={`/hotels-in/${encodeURIComponent(destination.city)}`}
                large={destination.large}
                sizes="(max-width: 768px) 100vw, 640px"
                priority={destination.large}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Exclusive deals — horizontal scroll */}
      <section className="overflow-hidden bg-surface-container py-20">
        <div className="mx-auto max-w-site px-gutter">
          <SectionHeading
            eyebrow="Limited Time"
            title="Exclusive Deals of the Day"
            action={{ label: 'View all offers', href: '/offers' }}
          />
          {featured.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              No properties listed yet. Approved properties will appear here.
            </div>
          ) : (
            <div className="no-scrollbar -mx-gutter flex snap-x gap-6 overflow-x-auto px-gutter pb-8 md:mx-0 md:px-0">
              {featured.map((property) => (
                <div
                  key={property.id}
                  className="w-[320px] shrink-0 snap-start md:w-[380px]"
                >
                  <PropertyCard property={property} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-site px-gutter py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl md:text-display-lg">
            The StayBD Difference
          </h2>
          <p className="mx-auto max-w-2xl text-body-lg text-muted-foreground">
            We combine local expertise with seamless technology to make every journey across
            Bangladesh effortless.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
          {VALUE_PROPS.map(({ Icon, tile, title, copy }) => (
            <div key={title} className="group text-center">
              <div
                className={`mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${tile}`}
              >
                <Icon className="size-10" aria-hidden />
              </div>
              <h3 className="mb-3 text-headline-md">{title}</h3>
              <p className="text-body-md text-muted-foreground">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Loyalty promo */}
      <section className="mx-auto max-w-site px-gutter pb-24">
        <div className="relative flex flex-col items-center gap-12 overflow-hidden rounded-3xl bg-primary p-12 md:flex-row md:p-20">
          <div className="absolute top-0 right-0 hidden h-full w-1/2 opacity-20 md:block">
            <Image
              src="/images/hero-island.jpg"
              alt=""
              fill
              sizes="50vw"
              className="object-cover grayscale invert"
            />
          </div>
          <div className="relative z-10 text-center md:w-3/5 md:text-left">
            <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-white sm:text-4xl md:text-display-lg">
              Earn points on every stay
            </h2>
            <p className="mb-10 text-headline-md text-on-primary-container">
              Create a free account to collect points, unlock member-only deals, and check in
              faster with bKash, Nagad or cards.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
              <Button asChild size="xl" className="bg-white text-primary hover:bg-white/90">
                <Link href="/signup">
                  <Sparkles className="size-5" aria-hidden />
                  Create free account
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/dashboard/points">How points work</Link>
              </Button>
            </div>
          </div>
          <div className="relative z-10 flex w-full flex-col items-center gap-4 rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-md md:w-2/5">
            <div className="flex items-center gap-1 text-2xl font-bold text-white">
              <Star className="size-6 fill-primary-fixed-dim text-primary-fixed-dim" aria-hidden />
              1 ৳ spent = 1 point
            </div>
            <p className="text-center text-label-md text-white">
              Redeem points for instant discounts on your next booking
            </p>
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-md text-primary-fixed-dim">
              <Wallet className="size-4" aria-hidden />
              Points apply automatically at checkout
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

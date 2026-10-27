import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'
import { ArrowRight, Coins, MapPin, Star, Waves } from 'lucide-react'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { BOOKING_ACTIVE_STATUSES } from '@/lib/bookings/statuses'
import { describeRoomItems } from '@/lib/bookings/summary'

export const metadata: Metadata = {
  title: 'Dashboard',
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-secondary text-secondary-foreground' },
  pending_payment: { label: 'Payment Pending', className: 'bg-primary text-primary-foreground' },
  checked_in: { label: 'Checked In', className: 'bg-tertiary text-tertiary-foreground' },
}

function nights(checkIn: string, checkOut: string): number {
  return Math.max(
    Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000),
    0,
  )
}

function formatRange(checkIn: string, checkOut: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${fmt(checkIn)} - ${fmt(checkOut)}`
}

function mediaUrl(media: unknown): string | null {
  return typeof media === 'object' && media !== null && 'url' in media
    ? ((media as { url?: string | null }).url ?? null)
    : null
}

export default async function DashboardPage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const [{ docs: upcoming }, { docs: past }, { docs: wishlist }] = await Promise.all([
    payload.find({
      collection: 'bookings',
      where: {
        and: [{ guest: { equals: user!.id } }, { status: { in: [...BOOKING_ACTIVE_STATUSES] } }],
      },
      sort: 'checkInDate',
      limit: 2,
      depth: 2,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'bookings',
      where: {
        and: [{ guest: { equals: user!.id } }, { status: { equals: 'checked_out' } }],
      },
      sort: '-checkOutDate',
      limit: 4,
      depth: 2,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'wishlist',
      where: { guest: { equals: user!.id } },
      sort: '-createdAt',
      limit: 3,
      depth: 1,
      overrideAccess: false,
      user,
    }),
  ])

  const initials = (user!.name ?? 'G')
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const wishlistPrices = new Map<number, number | null>()
  await Promise.all(
    wishlist.map(async (entry) => {
      const property = typeof entry.property === 'object' ? entry.property : null
      if (!property) return
      const { docs } = await payload.find({
        collection: 'room-types',
        where: { and: [{ property: { equals: property.id } }, { isActive: { equals: true } }] },
        sort: 'basePrice',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      wishlistPrices.set(property.id, docs[0]?.basePrice ?? null)
    }),
  )

  const propertyOf = (booking: (typeof upcoming)[number]) =>
    typeof booking.property === 'object' ? booking.property : null
  // A booking holds one row per room, so the chip describes the whole set ("2 × Deluxe Room"). The
  // `roomType` mirror is only a fallback for bookings written before rooms became line items.
  const roomSummaryOf = (booking: (typeof upcoming)[number]) =>
    describeRoomItems(booking.items) ||
    (typeof booking.roomType === 'object' && booking.roomType ? booking.roomType.name : '')

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Welcome back{user!.name ? `, ${user!.name}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your travel plans and explore new destinations.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden text-right sm:block">
            <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-primary">
              Loyalty Member
            </p>
            <p className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
              <Coins className="size-3.5 text-tertiary" aria-hidden />
              {(user!.pointsBalance ?? 0).toLocaleString('en-US')} Points
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary bg-primary-fixed text-sm font-bold text-primary ring-2 ring-background">
            {initials || 'G'}
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold text-primary">Upcoming Trips</h2>
          <Link
            href="/dashboard/bookings"
            className="text-sm font-bold text-secondary hover:underline"
          >
            See all trips
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-semibold">No upcoming trips</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Time to plan your next stay — explore hotels and resorts across Bangladesh.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Book New Trip
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {upcoming.map((booking) => {
              const property = propertyOf(booking)
              const roomSummary = roomSummaryOf(booking)
              const badge = STATUS_BADGES[booking.status ?? ''] ?? {
                label: (booking.status ?? '').replace(/_/g, ' '),
                className: 'bg-primary text-primary-foreground',
              }
              const image = property ? mediaUrl(property.heroImage) : null
              const stayNights = nights(booking.checkInDate, booking.checkOutDate)

              return (
                <article
                  key={booking.id}
                  className="group overflow-hidden rounded-xl border border-outline bg-card shadow-sm transition-all hover:shadow-md"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-container">
                    {image ? (
                      <Image
                        src={image}
                        alt={property?.name ?? 'Stay'}
                        fill
                        sizes="(max-width: 1024px) 100vw, 50vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Waves className="size-8" aria-hidden />
                      </div>
                    )}
                    <span
                      className={`absolute top-4 left-4 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold">
                          {property?.name ?? 'Stay'}
                        </h3>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          {property?.address?.city ?? 'Bangladesh'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-secondary">
                          {stayNights} night{stayNights === 1 ? '' : 's'}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {formatRange(booking.checkInDate, booking.checkOutDate)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {roomSummary ? (
                        <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-muted-foreground">
                          {roomSummary}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-semibold text-muted-foreground">
                        {booking.adults ?? 1} Adult{(booking.adults ?? 1) === 1 ? '' : 's'}
                        {booking.children ? `, ${booking.children} Child` : ''}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-outline pt-3">
                      <p className="text-sm text-muted-foreground">
                        Total{' '}
                        <span className="text-base font-extrabold text-primary">
                          ৳{(booking.pricing?.totalAmount ?? 0).toLocaleString('en-US')}
                        </span>
                      </p>
                      {booking.status === 'pending_payment' ? (
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/bookings/${booking.id}`}
                            className="text-sm font-bold text-secondary hover:underline"
                          >
                            Complete Payment
                          </Link>
                          <Link
                            href={`/dashboard/bookings/${booking.id}`}
                            className="rounded-lg bg-secondary px-5 py-2 text-sm font-bold text-secondary-foreground shadow-md transition-all hover:brightness-110 active:scale-[0.98]"
                          >
                            Pay Now
                          </Link>
                        </div>
                      ) : (
                        <Link
                          href={`/dashboard/bookings/${booking.id}`}
                          className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-primary-foreground transition-all hover:bg-primary-container active:scale-[0.98]"
                        >
                          Manage Booking
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">Saved Wishlist</h2>
            <Link
              href="/dashboard/wishlist"
              className="text-sm font-bold text-muted-foreground hover:text-primary"
            >
              {wishlist.length} item{wishlist.length === 1 ? '' : 's'}
            </Link>
          </div>
          <div className="flex flex-col gap-4">
            {wishlist.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing saved yet. Tap the heart on any property to save it here.
              </p>
            ) : (
              wishlist.map((entry) => {
                const property = typeof entry.property === 'object' ? entry.property : null
                if (!property) return null
                const image = mediaUrl(property.heroImage)
                return (
                  <Link
                    key={entry.id}
                    href={`/property/${property.slug}`}
                    className="group flex gap-4 rounded-xl border border-outline bg-card p-3 transition-all hover:shadow-sm"
                  >
                    <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-surface-container">
                      {image ? (
                        <Image
                          src={image}
                          alt={property.name}
                          fill
                          sizes="96px"
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-col justify-between overflow-hidden py-1">
                      <div>
                        <h4 className="truncate font-bold">{property.name}</h4>
                        <p className="text-xs text-muted-foreground">{property.address?.city}</p>
                      </div>
                      <p className="flex items-baseline gap-1.5">
                        <span className="text-lg font-extrabold text-secondary">
                          {wishlistPrices.get(property.id) != null
                            ? `৳${wishlistPrices.get(property.id)!.toLocaleString('en-US')}`
                            : 'Rates on request'}
                        </span>
                        {wishlistPrices.get(property.id) != null ? (
                          <span className="text-xs text-muted-foreground">/ night</span>
                        ) : null}
                      </p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </section>

        <section className="space-y-4 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">Past Bookings</h2>
            <Link
              href="/dashboard/bookings?tab=history"
              className="text-sm font-bold text-muted-foreground hover:text-primary"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-outline overflow-hidden rounded-xl border border-outline bg-card">
            {past.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No past stays yet. Completed trips will show up here.
              </p>
            ) : (
              past.map((booking) => {
                const property = typeof booking.property === 'object' ? booking.property : null
                const image = property ? mediaUrl(property.heroImage) : null
                return (
                  <div
                    key={booking.id}
                    className="flex flex-col justify-between gap-3 p-4 transition-colors hover:bg-surface-container-low md:flex-row md:items-center"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-surface-container">
                        {image ? (
                          <Image
                            src={image}
                            alt={property?.name ?? 'Stay'}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold">{property?.name ?? 'Stay'}</h4>
                        <p className="truncate text-sm text-muted-foreground">
                          {property?.address?.city ?? 'Bangladesh'} ·{' '}
                          {formatRange(booking.checkInDate, booking.checkOutDate)},{' '}
                          {new Date(booking.checkOutDate).getFullYear()}
                        </p>
                        <Link
                          href={`/dashboard/bookings/${booking.id}`}
                          className="mt-0.5 flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary"
                        >
                          <Star className="size-3.5" aria-hidden />
                          Leave a review
                        </Link>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 md:gap-4">
                      <div className="hidden text-right sm:block">
                        <p className="text-sm text-muted-foreground">Total Paid</p>
                        <p className="text-lg font-extrabold text-primary">
                          ৳{(booking.pricing?.totalAmount ?? 0).toLocaleString('en-US')}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/bookings/${booking.id}`}
                        className="rounded-lg border-2 border-primary px-4 py-2 text-sm font-bold text-primary transition-all hover:bg-primary hover:text-primary-foreground"
                      >
                        Invoice
                      </Link>
                      <Link
                        href={property ? `/property/${property.slug}` : '/'}
                        className="rounded-lg bg-surface-container px-4 py-2 text-sm font-bold transition-colors hover:bg-surface-container-high"
                      >
                        Rebook
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

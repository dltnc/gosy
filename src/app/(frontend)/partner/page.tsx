import type { Metadata } from 'next'
import Link from 'next/link'
import { BedDouble, CalendarClock, LineChart } from 'lucide-react'

import { requirePartner } from '@/features/partner/guard'
import { RevenueChart } from '@/features/partner/components/revenue-chart'
import { BOOKING_ACTIVE_STATUSES } from '@/lib/bookings/statuses'
import { describeRoomItems } from '@/lib/bookings/summary'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Overview',
}

const REVENUE_STATUSES = [...BOOKING_ACTIVE_STATUSES, 'checked_out'] as const

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

function dateOnly(value: string): string {
  return String(value).slice(0, 10)
}

function money(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-US')}`
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default async function PartnerOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ payload, user, isAdmin }, query] = await Promise.all([requirePartner(), searchParams])

  const propertyScope = isAdmin ? undefined : { partner: { equals: user.id } }
  const nestedPartnerScope = isAdmin ? undefined : { 'property.partner': { equals: user.id } }
  const range = (Array.isArray(query.range) ? query.range[0] : query.range) === '90' ? 90 : 30

  const today = new Date().toISOString().slice(0, 10)
  const windowStart = isoDaysAgo(range - 1)
  const prevStart = isoDaysAgo(2 * range - 1)

  const [properties, roomTypes, rooms, bookings] = await Promise.all([
    payload.find({
      collection: 'properties',
      ...(propertyScope ? { where: propertyScope } : {}),
      limit: 50,
      depth: 0,
      overrideAccess: false,
      user,
    }),
    payload.find({
      collection: 'room-types',
      where: {
        and: [{ isActive: { equals: true } }, ...(nestedPartnerScope ? [nestedPartnerScope] : [])],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'rooms',
      where: {
        and: [{ isActive: { equals: true } }, ...(nestedPartnerScope ? [nestedPartnerScope] : [])],
      },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'bookings',
      where: {
        and: [
          ...(isAdmin ? [] : [{ 'property.partner': { equals: user.id } }]),
          { checkInDate: { greater_than_equal: prevStart } },
          { status: { in: [...REVENUE_STATUSES] } },
        ],
      },
      sort: 'checkInDate',
      limit: 1000,
      depth: 1,
      overrideAccess: false,
      user,
    }),
  ])

  const { totalDocs: pendingCount } = await payload.count({
    collection: 'bookings',
    where: {
      and: [
        ...(isAdmin ? [] : [{ 'property.partner': { equals: user.id } }]),
        { status: { equals: 'pending_payment' } },
      ],
    },
    overrideAccess: false,
    user,
  })

  const { totalDocs: newTodayCount } = await payload.count({
    collection: 'bookings',
    where: {
      and: [
        ...(isAdmin ? [] : [{ 'property.partner': { equals: user.id } }]),
        { status: { equals: 'pending_payment' } },
        { createdAt: { greater_than_equal: `${today}T00:00:00.000Z` } },
      ],
    },
    overrideAccess: false,
    user,
  })

  const inWindow = bookings.docs.filter((booking) => dateOnly(booking.checkInDate) >= windowStart)
  const inPrevWindow = bookings.docs.filter(
    (booking) =>
      dateOnly(booking.checkInDate) >= prevStart && dateOnly(booking.checkInDate) < windowStart,
  )

  const dailyRevenue = new Map<string, number>()
  for (let i = range - 1; i >= 0; i -= 1) dailyRevenue.set(isoDaysAgo(i), 0)
  let upcomingRevenue = 0
  let upcomingCount = 0
  for (const booking of inWindow) {
    const bucket = dailyRevenue.get(dateOnly(booking.checkInDate))
    if (bucket !== undefined) {
      dailyRevenue.set(dateOnly(booking.checkInDate), bucket + (booking.pricing?.totalAmount ?? 0))
    } else if (dateOnly(booking.checkInDate) > today) {
      upcomingRevenue += booking.pricing?.totalAmount ?? 0
      upcomingCount += 1
    }
  }
  const chartValues = [...dailyRevenue.values()]
  const revenue = chartValues.reduce((sum, value) => sum + value, 0)
  const prevRevenue = inPrevWindow.reduce(
    (sum, booking) => sum + (booking.pricing?.totalAmount ?? 0),
    0,
  )
  const revenueDelta =
    prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null

  const todayEnd = new Date(`${today}T00:00:00.000Z`).getTime()
  const windowStartMs = new Date(`${windowStart}T00:00:00.000Z`).getTime()
  const consumedNights = (booking: (typeof bookings.docs)[number], fromMs: number) => {
    const checkInMs = new Date(`${dateOnly(booking.checkInDate)}T00:00:00.000Z`).getTime()
    const checkOutMs = new Date(`${dateOnly(booking.checkOutDate)}T00:00:00.000Z`).getTime()
    const start = Math.max(checkInMs, fromMs)
    const end = Math.min(checkOutMs, todayEnd)
    return Math.max(Math.round((end - start) / 86_400_000), 0)
  }

  const activeRooms = rooms.docs.length
  // A booking holds one row per physical room, so a three-room stay consumes three room-nights. The
  // fallback of 1 covers bookings written before rooms became line items.
  const roomCount = (booking: (typeof bookings.docs)[number]) => booking.items?.length || 1
  const bookedRoomNights = inWindow.reduce(
    (sum, booking) => sum + consumedNights(booking, windowStartMs) * roomCount(booking),
    0,
  )
  const occupancy =
    activeRooms > 0 ? Math.min((bookedRoomNights / (activeRooms * range)) * 100, 100) : 0
  const prevBookedRoomNights = inPrevWindow.reduce(
    (sum, booking) =>
      sum +
      consumedNights(booking, new Date(`${prevStart}T00:00:00.000Z`).getTime()) *
        roomCount(booking),
    0,
  )
  const prevOccupancy =
    activeRooms > 0 ? Math.min((prevBookedRoomNights / (activeRooms * range)) * 100, 100) : 0
  const occupancyDelta =
    prevOccupancy > 0 ? Math.round((occupancy - prevOccupancy) * 10) / 10 : null

  const arrivals = bookings.docs
    .filter(
      (booking) =>
        dateOnly(booking.checkInDate) === today &&
        (booking.status === 'confirmed' || booking.status === 'checked_in'),
    )
    .slice(0, 6)

  const inventory = roomTypes.docs
    .map((roomType) => {
      const total = rooms.docs.filter((room) =>
        typeof room.roomType === 'object'
          ? room.roomType.id === roomType.id
          : room.roomType === roomType.id,
      ).length
      // Count rows, not bookings: one booking taking three Deluxe rooms leaves three fewer to sell.
      const bookedTonight = bookings.docs.reduce((sum, booking) => {
        const occupiesTonight =
          dateOnly(booking.checkInDate) <= today && dateOnly(booking.checkOutDate) > today
        if (!occupiesTonight) return sum
        const rows = (booking.items ?? []).filter((item) => {
          const itemRoomType =
            item.roomType && typeof item.roomType === 'object' ? item.roomType.id : item.roomType
          return itemRoomType === roomType.id
        }).length
        if (rows > 0) return sum + rows
        const mirrored =
          booking.roomType && typeof booking.roomType === 'object'
            ? booking.roomType.id
            : booking.roomType
        return mirrored === roomType.id ? sum + 1 : sum
      }, 0)
      return {
        id: roomType.id,
        name: roomType.name,
        total,
        available: Math.max(total - bookedTonight, 0),
        booked: Math.min(bookedTonight, total),
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 4)

  const stats = [
    {
      label: 'Total Revenue',
      value: money(revenue),
      icon: LineChart,
      iconClass: 'bg-primary-fixed text-primary',
      badge:
        revenueDelta != null ? (
          <span
            className={cn(
              'rounded px-2 py-1 text-[11px] font-semibold',
              revenueDelta >= 0
                ? 'bg-tertiary/15 text-tertiary-container'
                : 'bg-secondary/10 text-secondary',
            )}
          >
            {revenueDelta >= 0 ? '+' : ''}
            {revenueDelta}%
          </span>
        ) : null,
    },
    {
      label: 'Occupancy Rate',
      value: `${occupancy.toFixed(1)}%`,
      icon: BedDouble,
      iconClass: 'bg-secondary/10 text-secondary',
      badge:
        occupancyDelta != null ? (
          <span
            className={cn(
              'rounded px-2 py-1 text-[11px] font-semibold',
              occupancyDelta >= 0
                ? 'bg-tertiary/15 text-tertiary-container'
                : 'bg-secondary/10 text-secondary',
            )}
          >
            {occupancyDelta >= 0 ? '+' : ''}
            {occupancyDelta}%
          </span>
        ) : null,
    },
    {
      label: 'Pending Bookings',
      value: String(pendingCount),
      icon: CalendarClock,
      iconClass: 'bg-tertiary/15 text-tertiary-container',
      badge:
        newTodayCount > 0 ? (
          <span className="rounded bg-primary-fixed px-2 py-1 text-[11px] font-semibold text-on-primary-container">
            {newTodayCount} New
          </span>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s how your properties are performing today.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-outline bg-surface-container-low p-1.5">
          {(
            [
              { label: 'Last 30 Days', value: '30' },
              { label: 'Last Quarter', value: '90' },
            ] as const
          ).map((option) => (
            <Link
              key={option.value}
              href={`/partner?range=${option.value}`}
              className={cn(
                'rounded px-4 py-2 text-sm font-bold transition-colors',
                range === Number(option.value)
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col justify-between rounded-xl border border-outline bg-card p-6 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  'flex size-11 items-center justify-center rounded-full',
                  stat.iconClass,
                )}
              >
                <stat.icon className="size-5" aria-hidden />
              </span>
              {stat.badge}
            </div>
            <div className="mt-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-2xl font-extrabold text-primary">{stat.value}</p>
              {stat.label === 'Total Revenue' && upcomingRevenue > 0 ? (
                <p className="mt-1 text-xs font-semibold text-tertiary-container">
                  +{money(upcomingRevenue)} booked · {upcomingCount} upcoming stay
                  {upcomingCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-outline bg-card p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Revenue Performance</h2>
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-primary-container" aria-hidden />
              <span className="text-sm text-muted-foreground">Last {range} Days</span>
            </div>
          </div>
          <RevenueChart values={chartValues} rangeLabel={`Last ${range} Days`} />
        </div>

        <div className="flex flex-col rounded-xl border border-outline bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-primary">Today&apos;s Arrivals</h2>
            <span className="rounded bg-secondary px-2 py-1 text-[11px] font-bold text-secondary-foreground">
              {arrivals.length} Total
            </span>
          </div>
          <div className="flex max-h-[300px] flex-col gap-3 overflow-y-auto pr-1">
            {arrivals.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No arrivals scheduled for today.
              </p>
            ) : (
              arrivals.map((booking) => {
                const guest = typeof booking.guest === 'object' ? booking.guest : null
                const roomType = typeof booking.roomType === 'object' ? booking.roomType : null
                const rooms = describeRoomItems(booking.items) || roomType?.name || 'Room'
                const property = typeof booking.property === 'object' ? booking.property : null
                const name = guest?.name ?? `Booking ${booking.bookingRef ?? booking.id}`
                return (
                  <Link
                    key={booking.id}
                    href={`/partner/bookings`}
                    className="flex items-center gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-outline hover:bg-surface-container-low"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-primary-fixed bg-primary-fixed/50 text-xs font-bold text-primary">
                      {initials(name) || 'G'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-primary">{name}</span>
                      <span className="block truncate text-[11px] font-semibold text-muted-foreground">
                        {rooms}
                        {property ? ` · ${property.name}` : ''} · {booking.pricing?.nights ?? 1}{' '}
                        night
                        {(booking.pricing?.nights ?? 1) === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm font-bold text-secondary">
                      {property?.policies?.checkInTime ?? '14:00'}
                    </span>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </div>

      {inventory.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">Inventory Pulse</h2>
            <Link
              href="/partner/properties"
              className="text-sm font-bold text-primary underline underline-offset-4 hover:text-primary-container"
            >
              Manage Inventory
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {inventory.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-1 rounded-lg border border-outline bg-card p-4"
              >
                <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
                  {item.name}
                </span>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-bold leading-none text-primary">
                    {String(item.available).padStart(2, '0')}
                  </span>
                  <span className="pb-0.5 text-sm text-muted-foreground">Available</span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      item.available === 0 ? 'bg-secondary' : 'bg-tertiary-container',
                    )}
                    style={{
                      width:
                        item.total > 0 ? `${Math.max((item.booked / item.total) * 100, 4)}%` : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {properties.docs.some((p) => p.status === 'draft') ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You have draft properties. Finish and submit them for review to go live.
        </p>
      ) : null}

      {properties.docs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-semibold">No properties yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first listing to start receiving bookings.
          </p>
          <Link
            href="/partner/properties/new"
            className="mt-4 inline-block rounded-lg bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground shadow-md"
          >
            Create a property
          </Link>
        </div>
      ) : null}
    </div>
  )
}

import type { Metadata } from 'next'
import { headers as getHeaders } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CheckoutView } from '@/features/booking-checkout/components/checkout-view'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { decodeRoomSelection, encodeRoomSelection } from '@/lib/bookings/constants'
import { buildQuote } from '@/lib/pricing/quote'

/**
 * Checkout for a whole stay: any mix of room types, any number of rooms of each.
 *
 * The selection travels in the query string (`?rooms=12:2,15:1`), which is what the property page's
 * booking panel builds, so a guest can reload or share the link and land on the same stay. Prices are
 * never recomputed here — `buildQuote` is the same authority the panel quoted from and the checkout
 * endpoint will charge.
 */

export const metadata: Metadata = {
  title: 'Checkout',
}

interface BookPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function BookPage({ searchParams }: BookPageProps) {
  const query = await searchParams

  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const rooms = firstParam(query.rooms)
  const checkInDate = firstParam(query.checkIn)
  const checkOutDate = firstParam(query.checkOut)

  if (!user) {
    const search = new URLSearchParams(
      Object.entries(query).flatMap(([key, value]) => {
        const single = firstParam(value)
        return single ? [[key, single] as [string, string]] : []
      }),
    )
    redirect(`/login?redirect=${encodeURIComponent(`/book?${search.toString()}`)}`)
  }

  const selection = decodeRoomSelection(rooms)
  if (selection.size === 0) notFound()
  if (
    !checkInDate ||
    !checkOutDate ||
    !ISO_DATE.test(checkInDate) ||
    !ISO_DATE.test(checkOutDate)
  ) {
    notFound()
  }

  const adults = Math.max(Number(firstParam(query.adults) ?? 2) || 2, 1)
  const children = Math.max(Number(firstParam(query.children) ?? 0) || 0, 0)

  const items = [...selection].map(([roomTypeId, quantity]) => ({ roomTypeId, quantity }))

  let quote
  try {
    quote = await buildQuote(payload, {
      items,
      checkInDate,
      checkOutDate,
      adults,
      children,
      guestId: user.id,
    })
  } catch {
    // A malformed selection (a deleted room type, mixed properties, an impossible date range) is not
    // something the guest can fix on this page.
    notFound()
  }

  const property = await payload.findByID({
    collection: 'properties',
    id: quote.propertyId,
    depth: 1,
    overrideAccess: true,
  })

  const backHref = `/property/${property.slug}?rooms=${encodeRoomSelection(selection)}&checkIn=${checkInDate}&checkOut=${checkOutDate}&adults=${adults}&children=${children}`

  const unavailable = quote.lines.filter((line) => line.available < line.quantity)
  if (unavailable.length === quote.lines.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">No rooms available</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {property.name} is fully booked for {checkInDate} → {checkOutDate}. Try different dates.
        </p>
        <Link href={backHref} className="mt-6 inline-block text-sm underline underline-offset-4">
          Back to property
        </Link>
      </div>
    )
  }

  const settings = await payload.findGlobal({ slug: 'platform-settings', depth: 0 })
  const loyaltySettings = settings.loyaltyProgram ?? {}

  const gateways = (['bkash', 'nagad', 'sslcommerz', 'aamarpay'] as const)
    .filter((slug) => Boolean(settings.paymentGateways?.[slug]?.enabled))
    .map((slug) => ({
      slug,
      label:
        slug === 'bkash'
          ? 'bKash'
          : slug === 'nagad'
            ? 'Nagad'
            : slug === 'sslcommerz'
              ? 'SSLCommerz (cards)'
              : 'AmarPay',
    }))

  const bankAccounts = (settings.bankTransferAccounts ?? []).map((account) => ({
    bankName: account.bankName,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    branchName: account.branchName,
    routingNumber: account.routingNumber,
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Complete your booking</h1>
        <p className="text-sm text-muted-foreground">
          Prices are final — taxes and platform fees included.{' '}
          <Link href={backHref} className="underline underline-offset-4">
            Change rooms or dates
          </Link>
        </p>
      </header>

      <CheckoutView
        items={items}
        initialQuote={quote}
        propertyName={property.name}
        propertyCity={property.address?.city ?? ''}
        propertyImageUrl={
          typeof property.heroImage === 'object' && property.heroImage !== null
            ? property.heroImage.url
            : null
        }
        propertyRating={property.avgRating ?? 0}
        propertyReviewCount={property.reviewCount ?? 0}
        cancellationPolicy={property.policies?.cancellationPolicy ?? null}
        checkInDate={checkInDate}
        checkOutDate={checkOutDate}
        adults={adults}
        childGuests={children}
        currency={settings.currency ?? 'BDT'}
        pointsBalance={user.pointsBalance ?? 0}
        loyalty={{
          enabled: loyaltySettings.enabled ?? false,
          redeemRate: loyaltySettings.redeemRate ?? 0,
          minRedeemPoints: loyaltySettings.minRedeemPoints ?? 0,
          maxRedeemPercentOfBooking: loyaltySettings.maxRedeemPercentOfBooking ?? 0,
        }}
        gateways={gateways}
        bankAccounts={bankAccounts}
        guestName={user.name ?? ''}
        guestEmail={user.email ?? ''}
        guestPhone={user.phone ?? ''}
      />
    </div>
  )
}

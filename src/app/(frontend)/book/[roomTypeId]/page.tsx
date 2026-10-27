import { notFound, redirect } from 'next/navigation'

/**
 * Legacy single-room checkout link.
 *
 * Checkout now works on a whole selection (`/book?rooms=12:2,15:1`), so this route only translates the
 * old shape and forwards. Old emails, bookmarks and the payment-status retry link still resolve.
 */

interface LegacyBookPageProps {
  params: Promise<{ roomTypeId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export default async function LegacyBookPage({ params, searchParams }: LegacyBookPageProps) {
  const [{ roomTypeId }, query] = await Promise.all([params, searchParams])

  const numericRoomTypeId = Number(roomTypeId)
  if (!Number.isFinite(numericRoomTypeId) || numericRoomTypeId <= 0) notFound()

  const checkIn = firstParam(query.checkIn)
  const checkOut = firstParam(query.checkOut)
  const dates =
    checkIn != null &&
    checkOut != null &&
    ISO_DATE.test(checkIn) &&
    ISO_DATE.test(checkOut) &&
    new Date(checkOut) > new Date(checkIn)
      ? { checkIn, checkOut }
      : { checkIn: isoDate(1), checkOut: isoDate(3) }

  const search = new URLSearchParams({
    rooms: `${numericRoomTypeId}:1`,
    checkIn: dates.checkIn,
    checkOut: dates.checkOut,
    adults: String(Math.max(Number(firstParam(query.adults) ?? 2) || 2, 1)),
    children: String(Math.max(Number(firstParam(query.children) ?? 0) || 0, 0)),
  })

  redirect(`/book?${search.toString()}`)
}

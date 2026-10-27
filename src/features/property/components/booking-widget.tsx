'use client'

import Link from 'next/link'
import { Minus, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { MAX_ROOMS_PER_BOOKING } from '@/lib/bookings/constants'
import { addDays, toISODate, useRoomSelection } from './room-selection-provider'

/**
 * The right-hand booking panel.
 *
 * It renders the selection built elsewhere on the page — a Reserve click on any accommodation card
 * lands here — and shows the server's quote for it, so the total on this panel is the total the
 * checkout charges. Guests can hold several rooms at once, including a mix of room types.
 */

interface BookingWidgetProps {
  currency: string
}

function money(currency: string, amount: number): string {
  return `${currency} ${Math.round(amount).toLocaleString('en-US')}`
}

export function BookingWidget({ currency }: BookingWidgetProps) {
  const {
    roomTypes,
    selection,
    rooms,
    checkIn,
    checkOut,
    adults,
    children,
    nights,
    quote,
    loading,
    error,
    setCheckIn,
    setCheckOut,
    setAdults,
    setChildren,
    checkoutHref,
  } = useRoomSelection()

  const selected = roomTypes.filter((roomType) => (selection.get(roomType.id) ?? 0) > 0)
  const cheapest = roomTypes.reduce<number | null>(
    (min, roomType) => (min == null ? roomType.basePrice : Math.min(min, roomType.basePrice)),
    null,
  )
  const headlineRate = selected[0]?.basePrice ?? cheapest ?? 0
  const subtotal = quote?.pricing.subtotal ?? 0
  const total = quote?.pricing.totalAmount ?? 0
  const atCeiling = rooms >= MAX_ROOMS_PER_BOOKING
  const minCheckOut = toISODate(addDays(new Date(`${checkIn}T00:00:00`), 1))

  const cellLabel = 'text-[10px] font-bold uppercase tracking-wide text-muted-foreground'
  const cellShell =
    'bg-card p-3 [&>input]:w-full [&>input]:border-0 [&>input]:bg-transparent [&>input]:p-0 [&>input]:text-sm [&>input]:font-bold [&>input]:outline-none'

  return (
    <div className="rounded-xl border-2 border-primary bg-card p-6 shadow-lift ring-4 ring-primary/5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <span className="text-[28px] font-extrabold leading-none text-primary">
            {money(currency, headlineRate)}
          </span>
          <span className="text-sm text-muted-foreground"> / night</span>
        </div>
        <span className="rounded bg-secondary/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-secondary">
          {nights > 0 ? `${nights} night${nights === 1 ? '' : 's'}` : 'Pick dates'}
        </span>
      </div>

      <div className="mb-3 space-y-3">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <div className={cellShell}>
            <div className={cellLabel}>Check-in</div>
            <input
              type="date"
              aria-label="Check-in date"
              value={checkIn}
              min={toISODate(new Date())}
              onChange={(event) => setCheckIn(event.target.value)}
            />
          </div>
          <div className={cellShell}>
            <div className={cellLabel}>Check-out</div>
            <input
              type="date"
              aria-label="Check-out date"
              value={checkOut}
              min={minCheckOut}
              onChange={(event) => setCheckOut(event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <div className={cellShell}>
            <div className={cellLabel}>Adults</div>
            <select
              aria-label="Adults"
              value={adults}
              onChange={(event) => setAdults(Number(event.target.value))}
              className="cursor-pointer"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                <option key={n} value={n}>
                  {n} Adult{n === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
          <div className={cellShell}>
            <div className={cellLabel}>Children</div>
            <select
              aria-label="Children"
              value={children}
              onChange={(event) => setChildren(Number(event.target.value))}
              className="cursor-pointer"
            >
              {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} Child{n === 1 ? '' : 'ren'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <SelectedRooms currency={currency} />

      {atCeiling ? (
        <p className="mb-3 text-xs font-semibold text-muted-foreground">
          {MAX_ROOMS_PER_BOOKING} rooms is the most one booking can hold. Split a larger party
          across bookings.
        </p>
      ) : null}

      <div className="mb-4 space-y-2 border-t border-dashed border-border pt-4">
        {quote && quote.lines.length > 0 ? (
          quote.lines.map((line) => (
            <div
              key={line.roomTypeId}
              className="flex justify-between text-sm text-muted-foreground"
            >
              <span>
                {line.quantity > 1 ? `${line.quantity} × ` : ''}
                {money(currency, line.nightlyRate)} × {line.nights} night
                {line.nights === 1 ? '' : 's'}
              </span>
              <span>{money(currency, line.lineSubtotal)}</span>
            </div>
          ))
        ) : (
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Select a room to see the price</span>
            <span>—</span>
          </div>
        )}

        {quote && quote.pricing.couponDiscountAmount > 0 ? (
          <div className="flex justify-between text-sm font-semibold text-primary">
            <span>Coupon discount</span>
            <span>−{money(currency, quote.pricing.couponDiscountAmount)}</span>
          </div>
        ) : null}

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Taxes &amp; fees</span>
          <span>Included</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-bold">
          <span>Total</span>
          <span>{quote ? money(currency, total || subtotal) : '—'}</span>
        </div>
      </div>

      {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}
      {quote?.issues.map((issue) => (
        <p key={issue} className="mb-2 text-sm text-destructive">
          {issue}
        </p>
      ))}

      {checkoutHref && rooms > 0 && nights >= 1 ? (
        <Link
          href={checkoutHref}
          className={cn(
            'block w-full rounded-xl bg-secondary py-4 text-center text-lg font-bold text-secondary-foreground shadow-lg transition-all',
            'hover:brightness-110 active:scale-[0.98]',
            loading && 'opacity-70',
          )}
        >
          {rooms > 1 ? `Book ${rooms} Rooms` : 'Book Now'}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-xl bg-secondary py-4 text-lg font-bold text-secondary-foreground opacity-50 shadow-lg"
        >
          {roomTypes.length === 0
            ? 'No rooms available'
            : rooms === 0
              ? 'Select a room'
              : 'Pick valid dates'}
        </button>
      )}
      <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">
        You won&apos;t be charged yet
      </p>
    </div>
  )
}

/** The rooms currently held, each with a stepper so the widget alone can build the whole stay. */
function SelectedRooms({ currency }: { currency: string }) {
  const { roomTypes, selection, rooms, quote, add, remove } = useRoomSelection()
  const held = roomTypes.filter((roomType) => (selection.get(roomType.id) ?? 0) > 0)

  if (held.length === 0) {
    return (
      <p className="mb-3 rounded-lg border border-dashed border-border p-3 text-xs font-semibold text-muted-foreground">
        Choose an accommodation below and it will appear here.
      </p>
    )
  }

  return (
    <ul className="mb-3 space-y-2">
      {held.map((roomType) => {
        const quantity = selection.get(roomType.id) ?? 0
        const line = quote?.lines.find((entry) => entry.roomTypeId === roomType.id)
        const soldOut = line != null && line.available < quantity
        return (
          <li
            key={roomType.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-container-low p-2.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{roomType.name}</span>
              <span className="block text-[11px] font-semibold text-muted-foreground">
                {money(currency, roomType.basePrice)} / night
                {soldOut ? ` · only ${line?.available} left` : ''}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => remove(roomType.id)}
                aria-label={`Remove one ${roomType.name}`}
                className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Minus className="size-3.5" aria-hidden />
              </button>
              <span className="w-4 text-center text-sm font-bold" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => add(roomType.id)}
                disabled={rooms >= MAX_ROOMS_PER_BOOKING}
                aria-label={`Add one ${roomType.name}`}
                className="grid size-7 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="size-3.5" aria-hidden />
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

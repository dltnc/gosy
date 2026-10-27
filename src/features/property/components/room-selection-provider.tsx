'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import type { Quote } from '@/lib/pricing/quote'
import { MAX_ROOMS_PER_BOOKING, encodeRoomSelection } from '@/lib/bookings/constants'

/**
 * Shared room selection for a property page.
 *
 * The stay being built lives here rather than inside the booking widget, because two separate parts of
 * the page act on it: the widget on the right, and the Reserve button on every accommodation card. A
 * Reserve click has to land in the widget the guest is looking at, and the page renders the widget
 * twice (a mobile copy above the fold and a sticky desktop one), so all three need one source of truth.
 *
 * Pricing is fetched from `/api/pricing/quote` rather than multiplied in the browser: the widget must
 * quote the same number the checkout will charge, including coupon and loyalty rules it cannot see.
 */

export interface SelectableRoomType {
  id: number
  name: string
  basePrice: number
  maxOccupancy?: number | null
}

export interface RoomSelectionValue {
  roomTypes: SelectableRoomType[]
  /** roomTypeId → how many rooms of it. Never holds zero entries. */
  selection: Map<number, number>
  rooms: number
  checkIn: string
  checkOut: string
  adults: number
  children: number
  nights: number
  quote: Quote | null
  loading: boolean
  error: string | null
  add: (roomTypeId: number) => void
  remove: (roomTypeId: number) => void
  setQuantity: (roomTypeId: number, quantity: number) => void
  clear: () => void
  setCheckIn: (value: string) => void
  setCheckOut: (value: string) => void
  setAdults: (value: number) => void
  setChildren: (value: number) => void
  /** URL for the checkout page carrying the current selection, or null when not bookable yet. */
  checkoutHref: string | null
}

const RoomSelectionContext = createContext<RoomSelectionValue | null>(null)

export function useRoomSelection(): RoomSelectionValue {
  const value = useContext(RoomSelectionContext)
  if (!value) throw new Error('useRoomSelection must be used inside a RoomSelectionProvider')
  return value
}

export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isValidDatePair(checkIn: string, checkOut: string): boolean {
  return ISO_DATE.test(checkIn) && ISO_DATE.test(checkOut) && new Date(checkOut) > new Date(checkIn)
}

export interface RoomSelectionProviderProps {
  roomTypes: SelectableRoomType[]
  initialSelection?: [number, number][]
  initialCheckIn?: string
  initialCheckOut?: string
  initialAdults?: number
  initialChildren?: number
  children: React.ReactNode
}

export function RoomSelectionProvider({
  roomTypes,
  initialSelection,
  initialCheckIn,
  initialCheckOut,
  initialAdults = 2,
  initialChildren = 0,
  children,
}: RoomSelectionProviderProps) {
  const defaults = useMemo(() => {
    const today = new Date()
    return { checkIn: toISODate(addDays(today, 1)), checkOut: toISODate(addDays(today, 3)) }
  }, [])

  const [checkIn, setCheckInState] = useState(
    initialCheckIn && ISO_DATE.test(initialCheckIn) ? initialCheckIn : defaults.checkIn,
  )
  const [checkOut, setCheckOutState] = useState(
    initialCheckOut && ISO_DATE.test(initialCheckOut) ? initialCheckOut : defaults.checkOut,
  )
  const [adults, setAdults] = useState(Math.max(initialAdults, 1))
  // Named apart from the `children` prop (this component renders a subtree) — the context still exposes
  // it as `children` because that is what the booking APIs call the guest count.
  const [childGuests, setChildGuests] = useState(Math.max(initialChildren, 0))

  // An empty selection is not a valid stay, so the page opens with the cheapest bookable room already
  // in the widget — the guest's most likely intent, and it keeps the price panel populated.
  const [selection, setSelection] = useState<Map<number, number>>(() => {
    const seeded = new Map<number, number>(initialSelection ?? [])
    const valid = new Map<number, number>()
    for (const [roomTypeId, quantity] of seeded) {
      if (roomTypes.some((roomType) => roomType.id === roomTypeId) && quantity > 0) {
        valid.set(roomTypeId, quantity)
      }
    }
    if (valid.size > 0) return valid
    const first = roomTypes[0]
    return first ? new Map([[first.id, 1]]) : new Map()
  })

  const rooms = useMemo(
    () => [...selection.values()].reduce((sum, quantity) => sum + quantity, 0),
    [selection],
  )

  const setQuantity = useCallback((roomTypeId: number, quantity: number) => {
    setSelection((current) => {
      const next = new Map(current)
      const others = [...next].reduce(
        (sum, [id, count]) => (id === roomTypeId ? sum : sum + count),
        0,
      )
      // Clamp instead of refusing, so the last room of a party lands the selection on the ceiling
      // rather than silently doing nothing.
      const capped = Math.min(Math.max(Math.floor(quantity), 0), MAX_ROOMS_PER_BOOKING - others)
      if (capped <= 0) next.delete(roomTypeId)
      else next.set(roomTypeId, capped)
      return next
    })
  }, [])

  const add = useCallback((roomTypeId: number) => {
    setSelection((current) => {
      const next = new Map(current)
      const total = [...next.values()].reduce((sum, count) => sum + count, 0)
      if (total >= MAX_ROOMS_PER_BOOKING) return current
      next.set(roomTypeId, (next.get(roomTypeId) ?? 0) + 1)
      return next
    })
  }, [])

  const remove = useCallback((roomTypeId: number) => {
    setSelection((current) => {
      const next = new Map(current)
      const quantity = (next.get(roomTypeId) ?? 0) - 1
      if (quantity <= 0) next.delete(roomTypeId)
      else next.set(roomTypeId, quantity)
      return next
    })
  }, [])

  const clear = useCallback(() => setSelection(new Map()), [])

  const setCheckIn = useCallback((value: string) => {
    setCheckInState(value)
    // Keep the stay coherent: moving check-in past check-out pushes check-out along by a night rather
    // than leaving an impossible range on screen.
    setCheckOutState((currentCheckOut) =>
      ISO_DATE.test(value) && new Date(currentCheckOut) <= new Date(value)
        ? toISODate(addDays(new Date(`${value}T00:00:00`), 1))
        : currentCheckOut,
    )
  }, [])

  const setCheckOut = useCallback((value: string) => {
    setCheckOutState(value)
  }, [])

  const nights = useMemo(
    () =>
      isValidDatePair(checkIn, checkOut)
        ? Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000)
        : 0,
    [checkIn, checkOut],
  )

  const selectionKey = useMemo(() => encodeRoomSelection(selection), [selection])

  /**
   * Everything the price depends on, as one string. Comparing it against the key a stored quote was
   * fetched for makes staleness and "still loading" derived values instead of state an effect has to
   * reset; an empty key means the stay cannot be priced yet.
   */
  const requestKey = useMemo(
    () =>
      selectionKey === '' || nights < 1
        ? ''
        : [selectionKey, checkIn, checkOut, adults, childGuests].join('|'),
    [selectionKey, checkIn, checkOut, adults, childGuests, nights],
  )

  const [result, setResult] = useState<{
    key: string
    quote: Quote | null
    error: string | null
  } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (requestKey === '') return

    const items = selectionKey.split(',').map((part) => {
      const [roomTypeId, quantity] = part.split(':')
      return { roomTypeId: Number(roomTypeId), quantity: Number(quantity) }
    })

    // Every keystroke on a date input would otherwise be a request; the guest sees the last one only.
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          items,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults,
          children: childGuests,
        }),
      })
        .then(async (response) => {
          const data = (await response.json().catch(() => null)) as
            (Quote & { errors?: { message?: string }[] }) | null
          if (!response.ok) {
            throw new Error(data?.errors?.[0]?.message ?? 'Could not price this stay right now.')
          }
          setResult({ key: requestKey, quote: data as Quote, error: null })
        })
        .catch((err: unknown) => {
          // An abort means a newer request took over, so the panel stays in its loading state.
          if (err instanceof DOMException && err.name === 'AbortError') return
          setResult({
            key: requestKey,
            quote: null,
            error: err instanceof Error ? err.message : 'Could not price this stay right now.',
          })
        })
    }, 300)

    return () => clearTimeout(timer)
  }, [requestKey, selectionKey, checkIn, checkOut, adults, childGuests])

  useEffect(() => () => abortRef.current?.abort(), [])

  const fresh = result?.key === requestKey ? result : null
  const quote = fresh?.quote ?? null
  const error = fresh?.error ?? null
  // The debounce window counts as loading too: what is on screen does not answer what the guest has
  // asked for until a result carrying this exact key arrives.
  const loading = requestKey !== '' && !fresh

  const checkoutHref = useMemo(() => {
    if (selectionKey === '' || nights < 1) return null
    const query = new URLSearchParams({
      rooms: selectionKey,
      checkIn,
      checkOut,
      adults: String(adults),
      children: String(childGuests),
    })
    return `/book?${query.toString()}`
  }, [selectionKey, checkIn, checkOut, adults, childGuests, nights])

  const value = useMemo<RoomSelectionValue>(
    () => ({
      roomTypes,
      selection,
      rooms,
      checkIn,
      checkOut,
      adults,
      children: childGuests,
      nights,
      quote,
      loading,
      error,
      add,
      remove,
      setQuantity,
      clear,
      setCheckIn,
      setCheckOut,
      setAdults,
      setChildren: setChildGuests,
      checkoutHref,
    }),
    [
      roomTypes,
      selection,
      rooms,
      checkIn,
      checkOut,
      adults,
      childGuests,
      nights,
      quote,
      loading,
      error,
      add,
      remove,
      setQuantity,
      clear,
      setCheckIn,
      setCheckOut,
      checkoutHref,
    ],
  )

  return <RoomSelectionContext.Provider value={value}>{children}</RoomSelectionContext.Provider>
}

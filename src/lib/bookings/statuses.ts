export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled_by_guest',
  'cancelled_by_partner',
  'no_show',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export const BOOKING_ACTIVE_STATUSES: BookingStatus[] = [
  'pending_payment',
  'confirmed',
  'checked_in',
]

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending_payment: ['confirmed', 'cancelled_by_guest', 'cancelled_by_partner'],
  // A no-show is a guest who never arrived, so it follows `confirmed` directly.
  // Kept reachable from `checked_in` too, which lets staff undo a mistaken check-in.
  confirmed: ['checked_in', 'no_show', 'cancelled_by_guest', 'cancelled_by_partner'],
  checked_in: ['checked_out', 'no_show'],
  checked_out: [],
  cancelled_by_guest: [],
  cancelled_by_partner: [],
  no_show: [],
}

export function isValidTransition(from: BookingStatus, to: BookingStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

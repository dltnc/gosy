import type { Quote } from '@/lib/pricing/quote'

export interface CheckoutResponse {
  booking: { id: number; bookingRef?: string | null; status: string }
  payment: { id: number } | null
  redirectUrl: string | null
  message?: string
}

/** One room type and how many rooms of it — the shape every booking API speaks. */
export interface RequestedRoom {
  roomTypeId: number
  quantity: number
}

export interface CouponApplyResponse {
  valid: boolean
  reason?: string
  discountAmount?: number
  subtotal?: number
  totalAmount?: number
}

export async function applyCouponCode(input: {
  couponCode: string
  items: RequestedRoom[]
  checkInDate: string
  checkOutDate: string
}): Promise<CouponApplyResponse> {
  const res = await fetch('/api/coupons/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (res.status === 429) throw new Error('Too many attempts. Please wait a minute.')
  if (!res.ok) throw new Error('Could not validate this code right now.')
  return res.json()
}

/**
 * Re-price a selection on the server.
 *
 * The checkout never multiplies rates, coupon values or point caps in the browser: it asks the same
 * endpoint the booking widget uses, so the total on screen is the total the booking will charge.
 */
export async function fetchQuote(
  input: {
    items: RequestedRoom[]
    checkInDate: string
    checkOutDate: string
    adults: number
    children: number
    couponCode?: string
    pointsRedeemed?: number
  },
  signal?: AbortSignal,
): Promise<Quote> {
  const res = await fetch('/api/pricing/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...(signal ? { signal } : {}),
    body: JSON.stringify(input),
  })
  const data = (await res.json().catch(() => null)) as
    (Quote & { errors?: { message?: string }[] }) | null
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.message ?? 'Could not price this stay right now.')
  }
  return data as Quote
}

export async function createBookingCheckout(input: {
  items: RequestedRoom[]
  checkInDate: string
  checkOutDate: string
  adults: number
  children: number
  guestPhone?: string
  specialRequests?: string
  pointsRedeemed?: number
  couponCode?: string
  gateway: string
}): Promise<CheckoutResponse> {
  const res = await fetch('/api/bookings/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })

  const data = (await res.json().catch(() => null)) as
    (CheckoutResponse & { errors?: { message?: string }[] }) | null

  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.message ?? data?.message ?? 'Could not create your booking.')
  }

  return data as CheckoutResponse
}

export async function uploadReceiptFile(file: File): Promise<number> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('_payload', JSON.stringify({ purpose: ['payment_proof'] }))

  const res = await fetch('/api/media', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Receipt upload failed. Please try again.')
  const media = (await res.json()) as { id: number }
  return media.id
}

export async function submitBankTransfer(input: {
  bookingId: number
  senderName?: string
  senderAccountNumber?: string
  transferReference: string
  receipt?: number
}): Promise<void> {
  const res = await fetch('/api/payments/bank-transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
    throw new Error(data?.errors?.[0]?.message ?? 'Could not submit transfer details.')
  }
}

export interface VerifyResponse {
  paymentStatus: string
  transactionId: string | null
  bookingStatus: string | null
}

export async function verifyPayment(
  paymentId: number,
  callbackData?: Record<string, unknown>,
): Promise<VerifyResponse> {
  const res = await fetch('/api/payments/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ paymentId, ...(callbackData ? { callbackData } : {}) }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
    throw new Error(data?.errors?.[0]?.message ?? 'Verification failed.')
  }
  return res.json()
}

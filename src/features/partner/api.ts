/**
 * Writes the partner dashboard makes against Payload's REST API.
 *
 * Kept in one module so the method-casing trap below is fixed once rather than in every component.
 */

/**
 * One write against Payload's REST API.
 *
 * The method is uppercased here because `fetch` only normalises the classic verbs — `patch` is *not*
 * on that list, so a lowercase spelling goes out on the wire as `patch` and Next's route handler,
 * which matches the method exactly, answers 405 with no JSON body. That was the "Request failed."
 * on the bookable toggles, so every caller goes through this function.
 */
export async function payloadWrite(url: string, method: string, body?: unknown): Promise<void> {
  await payloadFetch<unknown>(url, method, body)
}

/**
 * Same rules, but the response body matters — a checkout has to hand back a redirect URL.
 */
export async function payloadFetch<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = (await res.json().catch(() => null)) as
    (T & { errors?: { message?: string }[] }) | null
  if (!res.ok) {
    // Payload sends a message for anything it rejected itself; a bare status means it never got there.
    throw new Error(data?.errors?.[0]?.message ?? `Request failed (${res.status}).`)
  }
  return data as T
}

export type PayoutMethod = 'bkash' | 'nagad' | 'bank'

export interface PayoutProfileInput {
  payoutMethod: PayoutMethod
  payoutAccountNumber: string
  bankDetails: {
    bankName: string
    accountName: string
    accountNumber: string
    branchName: string
    routingNumber: string
  }
}

/**
 * Save where this partner wants to be paid.
 *
 * Only the payout subfields are sent: Payload keeps any group field absent from the payload at its
 * stored value, so this cannot blank out the KYC fields sitting beside them.
 */
export async function savePayoutProfile(
  userId: number | string,
  profile: PayoutProfileInput,
): Promise<void> {
  await payloadWrite(`/api/users/${userId}`, 'patch', { partnerProfile: profile })
}

/**
 * File a payout request.
 *
 * Amount is the only thing the client gets to choose — the destination, the balance it is checked
 * against and the status are all decided by the collection's hooks, so a crafted request cannot ask
 * for more than the ledger owes or point the money somewhere else.
 */
export async function requestPayout(input: { amount: number; notes?: string }): Promise<void> {
  await payloadWrite('/api/payouts', 'post', {
    amount: input.amount,
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
  })
}

export interface SubscriptionCheckoutInput {
  propertyId: number | string
  planId: number | string
  gateway: string
  transferReference?: string
  senderName?: string
  senderAccountNumber?: string
}

export interface SubscriptionCheckoutResult {
  redirectUrl: string | null
  message?: string
  payment: { id: number | string; status?: string } | null
}

/**
 * Buy or renew a subscription for one property.
 *
 * The price is deliberately not in this payload: the endpoint reads it from the plan. Everything the
 * client sends is a choice (which property, which plan, how to pay), never an amount.
 */
export async function startSubscriptionCheckout(
  input: SubscriptionCheckoutInput,
): Promise<SubscriptionCheckoutResult> {
  return payloadFetch<SubscriptionCheckoutResult>(
    '/api/property-subscriptions/checkout',
    'post',
    input,
  )
}

/**
 * Settle a gateway payment after the partner is redirected back.
 *
 * The gateway's redirect is not proof of payment, so the page asks the server to re-check with the
 * gateway; that update is what triggers the cascade that activates the subscription.
 */
export async function verifySubscriptionPayment(
  paymentId: number | string,
): Promise<{ paymentStatus: string }> {
  return payloadFetch<{ paymentStatus: string }>('/api/payments/verify', 'post', { paymentId })
}

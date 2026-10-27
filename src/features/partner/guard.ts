import 'server-only'

import { headers as getHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { partnerGateRedirect } from './gate'

/**
 * The gate every `/partner/*` page goes through.
 *
 * `partner/layout.tsx` already redirects, but a layout is not a reliable authorisation boundary: the
 * App Router renders layouts and their pages in the same pass, so a page's data fetching can start
 * before the layout's `redirect()` unwinds. Several of these pages read with `overrideAccess: true`
 * (the payout ledger, the subscription state), which means the page — not the layout — has to be the
 * thing that decides whether the caller is a partner.
 *
 * Guests are sent to their own dashboard rather than the homepage so a mis-click on "Partner Login"
 * lands somewhere that makes sense instead of silently bouncing.
 */
export interface PartnerSession {
  payload: Awaited<ReturnType<typeof getPayloadClient>>
  user: NonNullable<
    Awaited<ReturnType<Awaited<ReturnType<typeof getPayloadClient>>['auth']>>['user']
  >
  /** Admins browse the partner workspace unscoped, so every query branches on this. */
  isAdmin: boolean
}

export async function requirePartner(redirectTo = '/partner'): Promise<PartnerSession> {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const target = partnerGateRedirect(user, redirectTo)
  // `redirect` throws, so anything past this line has a partner or an admin attached. TypeScript
  // cannot see the link between `target` and `user`, hence the assertions.
  if (target) redirect(target)

  return { payload, user: user!, isAdmin: user!.role === 'admin' }
}

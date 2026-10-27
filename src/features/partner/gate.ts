/**
 * The partner-area access decision, isolated from the request so it can be tested without a database.
 *
 * Kept in its own module rather than beside `requirePartner` because that file is `server-only` and
 * pulls in the Payload client; a test that only wants to know where a guest is sent should not have
 * to boot a database to find out.
 */
export const PARTNER_ROLES = ['partner', 'admin'] as const

export type PartnerRole = (typeof PARTNER_ROLES)[number]

export function isPartnerRole(role: unknown): role is PartnerRole {
  return role === 'partner' || role === 'admin'
}

/**
 * `null` means "let them through". Anything else is the path to redirect to.
 *
 * A signed-out visitor is sent to the login form carrying the page they wanted, so the round trip
 * ends where it started. A signed-in guest is sent to their own dashboard rather than the homepage:
 * they are not lost, they are simply in the wrong workspace, and a silent bounce to `/` reads as a
 * broken link.
 */
export function partnerGateRedirect(
  user: { role?: string | null } | null | undefined,
  redirectTo = '/partner',
): string | null {
  if (!user) return `/login?redirect=${encodeURIComponent(redirectTo || '/partner')}`
  if (!isPartnerRole(user.role)) return '/dashboard'
  return null
}

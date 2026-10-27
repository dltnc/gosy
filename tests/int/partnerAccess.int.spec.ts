import { describe, expect, it } from 'vitest'
import type { Access } from 'payload'

import { partnerGateRedirect, isPartnerRole } from '@/features/partner/gate'
import { adminsOnly, adminsOrPartners, adminsOrSelf, authenticated } from '@/lib/access/predicates'

/**
 * The "partner dashboard must not be visible to guests" guarantee, checked at the two places that
 * actually enforce it: the page gate that decides who may render a `/partner/*` route, and the
 * collection predicates those pages read through.
 */

type Role = 'guest' | 'partner' | 'admin'

function callAccess(
  predicate: Access,
  user: { id?: number; role?: Role } | null,
  id?: number,
): unknown {
  return predicate({ req: { user }, id } as unknown as Parameters<Access>[0])
}

describe('partnerGateRedirect', () => {
  it('sends a signed-out visitor to the login form carrying the page they wanted', () => {
    expect(partnerGateRedirect(null, '/partner/payouts')).toBe(
      '/login?redirect=%2Fpartner%2Fpayouts',
    )
  })

  it('treats an undefined user the same as a null one', () => {
    expect(partnerGateRedirect(undefined)).toBe('/login?redirect=%2Fpartner')
  })

  it('sends a signed-in guest to their own dashboard rather than bouncing them to the homepage', () => {
    expect(partnerGateRedirect({ role: 'guest' })).toBe('/dashboard')
  })

  it('rejects a user whose role is missing or unrecognised', () => {
    expect(partnerGateRedirect({})).toBe('/dashboard')
    expect(partnerGateRedirect({ role: null })).toBe('/dashboard')
    expect(partnerGateRedirect({ role: 'moderator' })).toBe('/dashboard')
  })

  it('lets a partner and an admin through', () => {
    expect(partnerGateRedirect({ role: 'partner' })).toBeNull()
    expect(partnerGateRedirect({ role: 'admin' })).toBeNull()
  })

  it('falls back to /partner when handed an empty redirect target', () => {
    // A caller passing '' would otherwise produce `/login?redirect=`, which loses the round trip.
    expect(partnerGateRedirect(null, '')).toBe('/login?redirect=%2Fpartner')
  })

  it('escapes a query string in the redirect target so it survives the round trip', () => {
    expect(partnerGateRedirect(null, '/partner?range=90')).toBe(
      '/login?redirect=%2Fpartner%3Frange%3D90',
    )
  })
})

describe('isPartnerRole', () => {
  it('accepts only partner and admin', () => {
    expect(isPartnerRole('partner')).toBe(true)
    expect(isPartnerRole('admin')).toBe(true)
    expect(isPartnerRole('guest')).toBe(false)
    expect(isPartnerRole(undefined)).toBe(false)
  })
})

describe('collection predicates behind the partner pages', () => {
  it('keeps a guest out of admin-only collections', () => {
    expect(callAccess(adminsOnly, { id: 1, role: 'guest' })).toBe(false)
    expect(callAccess(adminsOnly, { id: 1, role: 'partner' })).toBe(false)
    expect(callAccess(adminsOnly, { id: 1, role: 'admin' })).toBe(true)
    expect(callAccess(adminsOnly, null)).toBe(false)
  })

  it('lets partners and admins into the shared partner collections, but not guests', () => {
    expect(callAccess(adminsOrPartners, { id: 1, role: 'guest' })).toBe(false)
    expect(callAccess(adminsOrPartners, { id: 1, role: 'partner' })).toBe(true)
    expect(callAccess(adminsOrPartners, { id: 1, role: 'admin' })).toBe(true)
    expect(callAccess(adminsOrPartners, null)).toBe(false)
  })

  it('scopes a self-service read to the requested row', () => {
    expect(callAccess(adminsOrSelf, { id: 7, role: 'guest' }, 7)).toBe(true)
    expect(callAccess(adminsOrSelf, { id: 7, role: 'guest' }, 8)).toBe(false)
    expect(callAccess(adminsOrSelf, { id: 7, role: 'admin' }, 8)).toBe(true)
    expect(callAccess(adminsOrSelf, null, 7)).toBe(false)
  })

  it('treats any signed-in role as authenticated — which is why pages cannot rely on it alone', () => {
    expect(callAccess(authenticated, { id: 1, role: 'guest' })).toBe(true)
    expect(callAccess(authenticated, null)).toBe(false)
  })
})

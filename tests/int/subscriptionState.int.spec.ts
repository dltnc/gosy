import { describe, expect, it } from 'vitest'

import {
  RENEWAL_WINDOW_DAYS,
  resolvePropertyState,
  toView,
  type RawSubscription,
} from '@/lib/subscriptions/state'

const NOW = new Date('2026-08-30T12:00:00.000Z')

function inDays(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString()
}

function row(overrides: Partial<RawSubscription> = {}): RawSubscription {
  return {
    id: 1,
    status: 'active',
    property: 42,
    plan: { id: 3, name: 'Featured 30', price: 2_000 },
    startDate: inDays(-10),
    endDate: inDays(20),
    ...overrides,
  }
}

describe('toView', () => {
  it('counts whole days of cover left and flags a renewal window', () => {
    const view = toView(row({ endDate: inDays(RENEWAL_WINDOW_DAYS - 1) }), NOW)

    expect(view.daysRemaining).toBe(RENEWAL_WINDOW_DAYS - 1)
    expect(view.live).toBe(true)
    expect(view.expiringSoon).toBe(true)
  })

  it('does not nag about renewal while there is plenty of cover', () => {
    const view = toView(row({ endDate: inDays(RENEWAL_WINDOW_DAYS + 1) }), NOW)

    expect(view.expiringSoon).toBe(false)
  })

  it('treats a stored active row whose end date has passed as not live', () => {
    // The expiry job runs daily, so between the end date and the next run the stored status lies.
    const view = toView(row({ status: 'active', endDate: inDays(-1) }), NOW)

    expect(view.status).toBe('active')
    expect(view.daysRemaining).toBe(0)
    expect(view.live).toBe(false)
    expect(view.expiringSoon).toBe(false)
  })

  it('never reports negative days remaining', () => {
    expect(toView(row({ endDate: inDays(-40) }), NOW).daysRemaining).toBe(0)
  })

  it('is live with no end date, because activation sets one and its absence is not an expiry', () => {
    const view = toView(row({ endDate: null }), NOW)

    expect(view.daysRemaining).toBeNull()
    expect(view.live).toBe(true)
    expect(view.expiringSoon).toBe(false)
  })

  it('ignores an unparseable end date rather than reading it as expired', () => {
    const view = toView(row({ endDate: 'not a date' }), NOW)

    expect(view.daysRemaining).toBeNull()
    expect(view.live).toBe(true)
  })

  it('keeps a pending payment row out of live regardless of its dates', () => {
    const view = toView(row({ status: 'pending_payment', endDate: inDays(30) }), NOW)

    expect(view.live).toBe(false)
  })

  it('defaults a missing status to pending payment instead of assuming active', () => {
    expect(toView(row({ status: null }), NOW).status).toBe('pending_payment')
  })

  it('reads the plan name only when the row was loaded with a join', () => {
    expect(toView(row({ plan: { id: 3, name: 'Featured 30' } }), NOW).planName).toBe('Featured 30')
    expect(toView(row({ plan: 3 }), NOW).planName).toBeNull()
    expect(toView(row({ plan: 3 }), NOW).planId).toBe(3)
  })
})

describe('resolvePropertyState', () => {
  it('ignores rows belonging to another property', () => {
    const state = resolvePropertyState(42, [row({ id: 1, property: 99 })], NOW)

    expect(state.current).toBeNull()
    expect(state.canPurchase).toBe(true)
  })

  it('matches ids across string and number spellings', () => {
    const state = resolvePropertyState('42', [row({ id: 1, property: { id: 42 } })], NOW)

    expect(state.current?.id).toBe(1)
  })

  it('prefers the live row that runs longest when two overlap', () => {
    const state = resolvePropertyState(
      42,
      [
        row({ id: 'short', endDate: inDays(3) }),
        row({ id: 'long', endDate: inDays(60) }),
        row({ id: 'lapsed', status: 'expired', endDate: inDays(-5) }),
      ],
      NOW,
    )

    expect(state.current?.id).toBe('long')
    expect(state.canPurchase).toBe(false)
  })

  it('falls back to the newest lapsed row so the page can name the expiry date', () => {
    const state = resolvePropertyState(
      42,
      [
        row({ id: 'older', status: 'expired', endDate: inDays(-90) }),
        row({ id: 'newer', status: 'expired', endDate: inDays(-2) }),
      ],
      NOW,
    )

    expect(state.current?.id).toBe('newer')
    expect(state.current?.live).toBe(false)
    expect(state.canPurchase).toBe(true)
  })

  it('blocks a second purchase while one is awaiting payment', () => {
    const state = resolvePropertyState(
      42,
      [row({ id: 'unpaid', status: 'pending_payment', endDate: null })],
      NOW,
    )

    expect(state.awaitingPayment?.id).toBe('unpaid')
    expect(state.canPurchase).toBe(false)
  })

  it('allows a renewal the day after cover lapses, even while the status still says active', () => {
    // The window between the end date and the daily expiry job: nothing may be sold twice, but a
    // partner whose promotion has actually stopped must be able to buy again immediately.
    const state = resolvePropertyState(42, [row({ status: 'active', endDate: inDays(-1) })], NOW)

    expect(state.current?.live).toBe(false)
    expect(state.canPurchase).toBe(true)
  })

  it('treats a cancelled subscription as free to replace', () => {
    const state = resolvePropertyState(42, [row({ status: 'cancelled', endDate: inDays(20) })], NOW)

    expect(state.canPurchase).toBe(true)
  })

  it('reports nothing at all for a property with no subscription history', () => {
    const state = resolvePropertyState(42, [], NOW)

    expect(state).toEqual({
      propertyId: 42,
      current: null,
      awaitingPayment: null,
      canPurchase: true,
    })
  })
})

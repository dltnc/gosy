import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  firstValue,
  getIntegrationSettings,
  invalidateIntegrationSettings,
  optionalCredential,
  requireCredential,
  resolveEmailConfig,
  resolveSmsConfig,
} from '@/lib/settings/integrations'

/**
 * Credential resolution: the admin-editable global first, the environment variable second.
 *
 * The point of the ordering is that an operator can take a value over from the admin panel without a
 * redeploy, while a deployment that has only ever set env vars keeps working against an empty global.
 * Both halves are exercised here with a stubbed `findGlobal`, so no admin panel or database is needed.
 */

function fakePayload(global: Record<string, unknown>) {
  const findGlobal = vi.fn().mockResolvedValue(global)
  return { payload: { findGlobal } as unknown as Payload, findGlobal }
}

afterEach(() => {
  invalidateIntegrationSettings()
  vi.unstubAllEnvs()
})

describe('firstValue', () => {
  it('treats blank and whitespace as not configured', () => {
    expect(firstValue('', '   ', 'real')).toBe('real')
    expect(firstValue('  padded  ')).toBe('padded')
    expect(firstValue(null, undefined, '')).toBeUndefined()
  })
})

describe('requireCredential', () => {
  it('prefers the stored value over the environment', () => {
    vi.stubEnv('BKASH_APP_KEY', 'from-env')
    expect(requireCredential('from-admin', 'BKASH_APP_KEY', 'bKash app key')).toBe('from-admin')
  })

  it('falls back to the environment when the global is blank', () => {
    vi.stubEnv('BKASH_APP_KEY', 'from-env')
    expect(requireCredential('   ', 'BKASH_APP_KEY', 'bKash app key')).toBe('from-env')
  })

  it('names both places to set it when neither has a value', () => {
    vi.stubEnv('BKASH_APP_KEY', '')
    expect(() => requireCredential(null, 'BKASH_APP_KEY', 'bKash app key')).toThrow(
      /bKash app key.*admin panel.*BKASH_APP_KEY/s,
    )
  })
})

describe('optionalCredential', () => {
  it('returns undefined rather than throwing when nothing is set', () => {
    vi.stubEnv('SMS_BD_SENDER_ID', '')
    expect(optionalCredential(undefined, 'SMS_BD_SENDER_ID')).toBeUndefined()
  })
})

describe('resolveEmailConfig', () => {
  it('reads the global first', async () => {
    vi.stubEnv('RESEND_API_KEY', 'env-key')
    const { payload } = fakePayload({
      email: { apiKey: 'admin-key', fromAddress: 'hello@staybd.test', fromName: 'StayBD' },
    })

    await expect(resolveEmailConfig(payload)).resolves.toEqual({
      apiKey: 'admin-key',
      fromAddress: 'hello@staybd.test',
      fromName: 'StayBD',
    })
  })

  it('falls back to env vars and then to defaults for the from-line', async () => {
    vi.stubEnv('RESEND_API_KEY', 'env-key')
    vi.stubEnv('RESEND_FROM_ADDRESS', '')
    vi.stubEnv('RESEND_FROM_NAME', '')
    const { payload } = fakePayload({ email: {} })

    await expect(resolveEmailConfig(payload)).resolves.toEqual({
      apiKey: 'env-key',
      fromAddress: 'no-reply@localhost',
      fromName: 'Bookings',
    })
  })

  it('is null when no key exists anywhere, so senders skip instead of throwing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { payload } = fakePayload({ email: { fromAddress: 'hello@staybd.test' } })

    await expect(resolveEmailConfig(payload)).resolves.toBeNull()
  })
})

describe('resolveSmsConfig', () => {
  it('strips a trailing slash off the base URL', async () => {
    const { payload } = fakePayload({
      sms: { apiKey: 'k', baseUrl: 'https://sms.example.test/', senderId: 'StayBD' },
    })

    await expect(resolveSmsConfig(payload)).resolves.toMatchObject({
      baseURL: 'https://sms.example.test',
      senderId: 'StayBD',
    })
  })

  it('replaces a nonsense balance threshold with the default', async () => {
    const { payload } = fakePayload({ sms: { apiKey: 'k', balanceThreshold: -1 } })
    await expect(resolveSmsConfig(payload)).resolves.toMatchObject({ balanceThreshold: 500 })
  })

  it('is null without a key', async () => {
    vi.stubEnv('SMS_BD_API_KEY', '')
    const { payload } = fakePayload({ sms: {} })
    await expect(resolveSmsConfig(payload)).resolves.toBeNull()
  })
})

describe('caching', () => {
  it('reads the global once per window and again after an admin edit', async () => {
    const { payload, findGlobal } = fakePayload({ email: { apiKey: 'admin-key' } })

    await getIntegrationSettings(payload)
    await getIntegrationSettings(payload)
    expect(findGlobal).toHaveBeenCalledTimes(1)

    invalidateIntegrationSettings()
    await getIntegrationSettings(payload)
    expect(findGlobal).toHaveBeenCalledTimes(2)
  })

  it('reads it with overrideAccess, since callers are servers and not admins', async () => {
    const { payload, findGlobal } = fakePayload({ email: {} })

    await getIntegrationSettings(payload)
    expect(findGlobal).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'integration-settings', overrideAccess: true }),
    )
  })
})

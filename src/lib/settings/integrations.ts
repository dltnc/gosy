import type { Payload } from 'payload'

import type { IntegrationSetting } from '@/payload-types'

/**
 * Runtime resolution of third-party credentials.
 *
 * Resolution order for every credential is: the `integration-settings` global first, then the
 * matching environment variable. That ordering lets an admin take over a value from the admin panel
 * without a redeploy, while a deployment that has only ever used env vars keeps working with an
 * empty global.
 *
 * The global is read with `overrideAccess: true` because callers are servers (payment endpoints,
 * jobs, hooks), not users — its `access.read` is admin-only and must stay that way.
 *
 * Reads are memoised for a few seconds rather than with React `cache()`, because most callers are
 * Payload hooks and queue jobs that run outside a React render pass. Writes to the global clear the
 * cache through `invalidateIntegrationSettings`, so an admin's edit takes effect immediately.
 */

const TTL_MS = 15_000

let cache: { at: number; value: IntegrationSetting } | null = null

export function invalidateIntegrationSettings(): void {
  cache = null
}

export async function getIntegrationSettings(payload: Payload): Promise<IntegrationSetting> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value

  const value = (await payload.findGlobal({
    slug: 'integration-settings',
    depth: 0,
    overrideAccess: true,
  })) as IntegrationSetting

  cache = { at: Date.now(), value }
  return value
}

/** First non-blank string, trimmed. Treats `''`, `null` and whitespace as "not configured". */
export function firstValue(...candidates: (string | null | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    const trimmed = typeof candidate === 'string' ? candidate.trim() : ''
    if (trimmed) return trimmed
  }
  return undefined
}

/**
 * Resolve a mandatory credential, or throw an error that tells an operator both places it can be
 * set. Gateway failures are otherwise near-impossible to diagnose from a 500.
 */
export function requireCredential(
  value: string | null | undefined,
  envVar: string,
  label: string,
): string {
  const resolved = firstValue(value, process.env[envVar])
  if (!resolved) {
    throw new Error(
      `Missing ${label}. Set it under Integrations & Credentials in the admin panel, or as the ${envVar} environment variable.`,
    )
  }
  return resolved
}

/** Optional credential with env fallback. */
export function optionalCredential(
  value: string | null | undefined,
  envVar: string,
): string | undefined {
  return firstValue(value, process.env[envVar])
}

export interface ResolvedEmailConfig {
  apiKey: string
  fromAddress: string
  fromName: string
}

/** `null` when email is not configured at all, so senders can skip instead of throwing. */
export async function resolveEmailConfig(payload: Payload): Promise<ResolvedEmailConfig | null> {
  const email = (await getIntegrationSettings(payload))?.email
  const apiKey = optionalCredential(email?.apiKey, 'RESEND_API_KEY')
  if (!apiKey) return null

  return {
    apiKey,
    fromAddress:
      optionalCredential(email?.fromAddress, 'RESEND_FROM_ADDRESS') ?? 'no-reply@localhost',
    fromName: optionalCredential(email?.fromName, 'RESEND_FROM_NAME') ?? 'Bookings',
  }
}

export async function isEmailConfigured(payload: Payload): Promise<boolean> {
  return (await resolveEmailConfig(payload)) !== null
}

export async function resolveEmailWebhookSecret(payload: Payload): Promise<string | undefined> {
  const email = (await getIntegrationSettings(payload))?.email
  return optionalCredential(email?.webhookSecret, 'RESEND_WEBHOOK_SECRET')
}

export interface ResolvedSmsConfig {
  apiKey: string
  baseURL: string
  senderId: string | undefined
  balanceThreshold: number
}

/** `null` when SMS is not configured, so OTP and alert paths can degrade instead of throwing. */
export async function resolveSmsConfig(payload: Payload): Promise<ResolvedSmsConfig | null> {
  const sms = (await getIntegrationSettings(payload))?.sms
  const apiKey = optionalCredential(sms?.apiKey, 'SMS_BD_API_KEY')
  if (!apiKey) return null

  const threshold = Number(sms?.balanceThreshold ?? process.env.SMS_BD_BALANCE_THRESHOLD ?? 500)

  return {
    apiKey,
    baseURL: (optionalCredential(sms?.baseUrl, 'SMS_BD_BASE_URL') ?? 'https://api.smsbd.net')
      // A trailing slash would produce `//sendsms` and a 404.
      .replace(/\/$/, ''),
    senderId: optionalCredential(sms?.senderId, 'SMS_BD_SENDER_ID'),
    balanceThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 500,
  }
}

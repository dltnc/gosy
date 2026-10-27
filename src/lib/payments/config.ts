import fsp from 'fs/promises'
import type { Payload } from 'payload'
import type { GatewaySlug } from './gateway.interface'
import {
  firstValue,
  getIntegrationSettings,
  optionalCredential,
  requireCredential,
} from '../settings/integrations'

/**
 * Gateway credential loaders.
 *
 * Each credential comes from the `integration-settings` global first and the matching environment
 * variable second, so an admin can rotate a key from the admin panel without a redeploy while
 * env-only deployments keep working. Sandbox/live mode stays in `platform-settings` because the
 * public checkout page already reads that global.
 */

export interface BkashConfig {
  baseURL: string
  appKey: string
  appSecret: string
  username: string
  password: string
}

export interface SslCommerzConfig {
  baseURL: string
  storeId: string
  storePassword: string
}

export interface NagadConfig {
  baseURL: string
  merchantId: string
  privateKeyPem: string
  publicKeyPem: string
  callbackUrl: string
}

export interface AmarPayConfig {
  baseURL: string
  storeId: string
  signatureKey: string
}

export type GatewayMode = 'sandbox' | 'live'

export async function getGatewayMode(payload: Payload, slug: GatewaySlug): Promise<GatewayMode> {
  const settings = await payload.findGlobal({
    slug: 'platform-settings',
    depth: 0,
    overrideAccess: true,
  })
  return settings?.paymentGateways?.[slug]?.mode === 'live' ? 'live' : 'sandbox'
}

/**
 * Nagad signs with RSA keys. The global holds the PEM inline (what an admin can paste), while the
 * legacy env vars hold *paths* to key files — hence the read-through-to-disk fallback.
 */
async function resolvePem(
  inline: string | null | undefined,
  envPathVar: string,
  label: string,
): Promise<string> {
  const pasted = firstValue(inline)
  if (pasted) return pasted

  const keyPath = firstValue(process.env[envPathVar])
  if (!keyPath) {
    throw new Error(
      `Missing ${label}. Paste the PEM under Integrations & Credentials in the admin panel, or point ${envPathVar} at a key file.`,
    )
  }

  try {
    return await fsp.readFile(keyPath, 'utf8')
  } catch {
    throw new Error(`Could not read ${label} from ${envPathVar} (${keyPath}).`)
  }
}

export async function getBkashConfig(payload: Payload, mode?: string | null): Promise<BkashConfig> {
  const [settings, effectiveMode] = await Promise.all([
    getIntegrationSettings(payload),
    mode ? Promise.resolve(mode) : getGatewayMode(payload, 'bkash'),
  ])
  const bkash = settings?.bkash

  return {
    baseURL:
      optionalCredential(bkash?.baseUrl, 'BKASH_BASE_URL') ??
      (effectiveMode === 'live'
        ? 'https://tokenized.pay.bka.sh/v1.2.0-beta'
        : 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'),
    appKey: requireCredential(bkash?.appKey, 'BKASH_APP_KEY', 'bKash app key'),
    appSecret: requireCredential(bkash?.appSecret, 'BKASH_APP_SECRET', 'bKash app secret'),
    username: requireCredential(bkash?.username, 'BKASH_USERNAME', 'bKash username'),
    password: requireCredential(bkash?.password, 'BKASH_PASSWORD', 'bKash password'),
  }
}

export async function getSslCommerzConfig(
  payload: Payload,
  mode?: string | null,
): Promise<SslCommerzConfig> {
  const [settings, effectiveMode] = await Promise.all([
    getIntegrationSettings(payload),
    mode ? Promise.resolve(mode) : getGatewayMode(payload, 'sslcommerz'),
  ])
  const ssl = settings?.sslcommerz

  return {
    baseURL:
      optionalCredential(ssl?.baseUrl, 'SSLCOMMERZ_BASE_URL') ??
      (effectiveMode === 'live'
        ? 'https://securepay.sslcommerz.com'
        : 'https://sandbox.sslcommerz.com'),
    storeId: requireCredential(ssl?.storeId, 'SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ store ID'),
    storePassword: requireCredential(
      ssl?.storePassword,
      'SSLCOMMERZ_STORE_PASSWORD',
      'SSLCOMMERZ store password',
    ),
  }
}

export async function getNagadConfig(payload: Payload): Promise<NagadConfig> {
  const nagad = (await getIntegrationSettings(payload))?.nagad

  // Nagad's sandbox host differs per merchant onboarding, so there is no safe sandbox default to
  // derive from the mode toggle: the base URL has to be configured explicitly to leave production.
  const [privateKeyPem, publicKeyPem] = await Promise.all([
    resolvePem(nagad?.privateKeyPem, 'NAGAD_PRIVATE_KEY_PATH', 'Nagad merchant private key'),
    resolvePem(nagad?.publicKeyPem, 'NAGAD_PUBLIC_KEY_PATH', 'Nagad public key'),
  ])

  return {
    baseURL: optionalCredential(nagad?.baseUrl, 'NAGAD_BASE_URL') ?? 'https://api.mynagad.com/api/dfs',
    merchantId: requireCredential(nagad?.merchantId, 'NAGAD_MERCHANT_ID', 'Nagad merchant ID'),
    privateKeyPem,
    publicKeyPem,
    callbackUrl: requireCredential(nagad?.callbackUrl, 'NAGAD_CALLBACK_URL', 'Nagad callback URL'),
  }
}

export async function getAmarPayConfig(
  payload: Payload,
  mode?: string | null,
): Promise<AmarPayConfig> {
  const [settings, effectiveMode] = await Promise.all([
    getIntegrationSettings(payload),
    mode ? Promise.resolve(mode) : getGatewayMode(payload, 'aamarpay'),
  ])
  const aamarpay = settings?.aamarpay

  return {
    baseURL:
      optionalCredential(aamarpay?.baseUrl, 'AMARPAY_BASE_URL') ??
      (effectiveMode === 'live' ? 'https://secure.aamarpay.com' : 'https://sandbox.aamarpay.com'),
    storeId: requireCredential(aamarpay?.storeId, 'AMARPAY_STORE_ID', 'aamarPay store ID'),
    signatureKey: requireCredential(
      aamarpay?.signatureKey,
      'AMARPAY_SIGNATURE_KEY',
      'aamarPay signature key',
    ),
  }
}

export function isGatewayEnabled(settings: unknown, slug: GatewaySlug): boolean {
  const gateways = (settings as { paymentGateways?: Record<string, { enabled?: boolean }> } | null)
    ?.paymentGateways
  return Boolean(gateways?.[slug]?.enabled)
}

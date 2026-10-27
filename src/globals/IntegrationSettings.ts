import type { Field, GlobalConfig, TextField } from 'payload'
import { adminsOnly } from '../lib/access/predicates'
import { invalidateIntegrationSettings } from '../lib/settings/integrations'

/**
 * Third-party credentials, editable from the admin panel.
 *
 * Read access is admin-only and the global is hidden from every other role, because unlike
 * `platform-settings` (which is public so the checkout page can read gateway toggles and loyalty
 * rules) this document holds live secrets. Never relax `access.read` here, and never mirror a field
 * from this global into a publicly readable one.
 *
 * Secrets are encrypted at rest with `payload.encrypt` (AES-256-CTR keyed by `PAYLOAD_SECRET`), so
 * a database dump alone does not leak them. Rotating `PAYLOAD_SECRET` therefore invalidates every
 * stored secret — they have to be re-entered.
 *
 * Every field is optional: whatever is left blank falls back to the matching environment variable,
 * so an existing env-only deployment keeps working untouched. See `src/lib/settings/integrations.ts`
 * for the resolution order.
 */

/** Text field whose value is encrypted in the database and decrypted on read. */
function secret(name: string, label: string, envVar: string, textarea = false): Field {
  const description = `Leave blank to use the ${envVar} environment variable. Stored encrypted.`

  const hooks: TextField['hooks'] = {
    beforeChange: [
      ({ value, req }) => {
        if (typeof value !== 'string' || !value) return value
        return req.payload.encrypt(value)
      },
    ],
    afterRead: [
      ({ value, req }) => {
        if (typeof value !== 'string' || !value) return value
        try {
          return req.payload.decrypt(value)
        } catch {
          // Value predates encryption, or PAYLOAD_SECRET has been rotated. Hand back what is
          // stored rather than breaking every read of the global.
          return value
        }
      },
    ],
  }

  // Built as two branches rather than one object with a computed `type`, because Payload's `Field`
  // is a discriminated union — a `type` of `'text' | 'textarea'` matches neither member.
  return textarea
    ? { name, type: 'textarea', label, admin: { description, rows: 6 }, hooks }
    : { name, type: 'text', label, admin: { description }, hooks }
}

/** Plain (non-secret) text field with the same env-fallback wording. */
function plain(name: string, label: string, envVar: string, description?: string): Field {
  return {
    name,
    type: 'text',
    label,
    admin: {
      description: description
        ? `${description} Leave blank to use ${envVar}.`
        : `Leave blank to use the ${envVar} environment variable.`,
    },
  }
}

export const IntegrationSettings: GlobalConfig = {
  slug: 'integration-settings',
  label: 'Integrations & Credentials',
  admin: {
    group: 'Settings',
    description:
      'API credentials for payment gateways, email and SMS. Admin-only. Blank fields fall back to environment variables.',
    hidden: ({ user }) => user?.role !== 'admin',
  },
  access: {
    read: adminsOnly,
    update: adminsOnly,
    readVersions: adminsOnly,
  },
  hooks: {
    // Credentials are memoised for a few seconds at runtime; drop that cache the moment an admin
    // saves so a corrected key takes effect on the next request instead of after the TTL.
    afterChange: [
      () => {
        invalidateIntegrationSettings()
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Payments',
          description:
            'Which gateways are offered to guests, and sandbox/live mode, stay under Platform Settings. Only credentials live here.',
          fields: [
            {
              name: 'bkash',
              type: 'group',
              label: 'bKash',
              fields: [
                plain(
                  'baseUrl',
                  'Base URL',
                  'BKASH_BASE_URL',
                  'Overrides the sandbox/live default for the mode selected in Platform Settings.',
                ),
                secret('appKey', 'App key', 'BKASH_APP_KEY'),
                secret('appSecret', 'App secret', 'BKASH_APP_SECRET'),
                secret('username', 'Username', 'BKASH_USERNAME'),
                secret('password', 'Password', 'BKASH_PASSWORD'),
              ],
            },
            {
              name: 'nagad',
              type: 'group',
              label: 'Nagad',
              fields: [
                plain('baseUrl', 'Base URL', 'NAGAD_BASE_URL'),
                plain('merchantId', 'Merchant ID', 'NAGAD_MERCHANT_ID'),
                plain('callbackUrl', 'Callback URL', 'NAGAD_CALLBACK_URL'),
                secret(
                  'privateKeyPem',
                  'Merchant private key (PEM)',
                  'NAGAD_PRIVATE_KEY_PATH',
                  true,
                ),
                secret('publicKeyPem', 'Nagad public key (PEM)', 'NAGAD_PUBLIC_KEY_PATH', true),
              ],
            },
            {
              name: 'sslcommerz',
              type: 'group',
              label: 'SSLCOMMERZ',
              fields: [
                plain('baseUrl', 'Base URL', 'SSLCOMMERZ_BASE_URL'),
                secret('storeId', 'Store ID', 'SSLCOMMERZ_STORE_ID'),
                secret('storePassword', 'Store password', 'SSLCOMMERZ_STORE_PASSWORD'),
              ],
            },
            {
              name: 'aamarpay',
              type: 'group',
              label: 'aamarPay',
              fields: [
                plain('baseUrl', 'Base URL', 'AMARPAY_BASE_URL'),
                secret('storeId', 'Store ID', 'AMARPAY_STORE_ID'),
                secret('signatureKey', 'Signature key', 'AMARPAY_SIGNATURE_KEY'),
              ],
            },
          ],
        },
        {
          label: 'Email',
          description:
            'Transactional email. Without an API key here or in the environment, emails are skipped and logged as failed rather than throwing.',
          fields: [
            {
              name: 'email',
              type: 'group',
              label: false,
              fields: [
                {
                  name: 'provider',
                  type: 'select',
                  defaultValue: 'resend',
                  options: [{ label: 'Resend', value: 'resend' }],
                  admin: { description: 'Only Resend is implemented today.' },
                },
                secret('apiKey', 'Resend API key', 'RESEND_API_KEY'),
                plain('fromAddress', 'From address', 'RESEND_FROM_ADDRESS'),
                plain('fromName', 'From name', 'RESEND_FROM_NAME'),
                secret('webhookSecret', 'Webhook signing secret', 'RESEND_WEBHOOK_SECRET'),
              ],
            },
          ],
        },
        {
          label: 'SMS',
          fields: [
            {
              name: 'sms',
              type: 'group',
              label: false,
              fields: [
                {
                  name: 'provider',
                  type: 'select',
                  defaultValue: 'smsbd',
                  options: [{ label: 'sms.bd / Alpha SMS', value: 'smsbd' }],
                  admin: { description: 'Only sms.bd is implemented today.' },
                },
                secret('apiKey', 'API key', 'SMS_BD_API_KEY'),
                plain('baseUrl', 'Base URL', 'SMS_BD_BASE_URL'),
                plain('senderId', 'Sender ID', 'SMS_BD_SENDER_ID'),
                {
                  name: 'balanceThreshold',
                  type: 'number',
                  label: 'Low-balance alert threshold',
                  min: 0,
                  admin: {
                    description:
                      'The daily balance job alerts admins below this figure. Blank uses SMS_BD_BALANCE_THRESHOLD, then 500.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

import { resendAdapter } from '@payloadcms/email-resend'
import { APIError, type EmailAdapter } from 'payload'

import { resolveEmailConfig } from '../settings/integrations'

/**
 * Email adapter that resolves its credentials per send.
 *
 * Payload builds its email adapter once, when the config module is evaluated, which is long before
 * a database connection exists — so an adapter constructed from `process.env.RESEND_API_KEY` can
 * never pick up a key an admin typed into the admin panel. This wrapper defers the decision: the
 * key, from-address and from-name are resolved on every send (memoised for a few seconds by
 * `getIntegrationSettings`), then handed to the real Resend adapter, which still does the
 * Payload-message → Resend-payload mapping.
 *
 * When nothing is configured this throws rather than silently dropping the message. Application
 * senders in `send.ts` check `isEmailConfigured` first and skip, so the loud path is reserved for
 * Payload's own emails (password resets), where failing visibly is the safer outcome.
 */
export const runtimeEmailAdapter: EmailAdapter<unknown> = ({ payload }) => ({
  name: 'runtime-resend',
  // Advertised defaults only; the resolved values below are what actually get used.
  defaultFromAddress: process.env.RESEND_FROM_ADDRESS || 'no-reply@localhost',
  defaultFromName: process.env.RESEND_FROM_NAME || 'Bookings',
  sendEmail: async (message) => {
    const config = await resolveEmailConfig(payload)

    if (!config) {
      throw new APIError(
        'Email is not configured. Add a Resend API key under Integrations & Credentials in the admin panel, or set RESEND_API_KEY.',
        500,
      )
    }

    const resend = resendAdapter({
      apiKey: config.apiKey,
      defaultFromAddress: config.fromAddress,
      defaultFromName: config.fromName,
    })({ payload })

    return resend.sendEmail(message)
  },
})

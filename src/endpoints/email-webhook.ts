import type { Endpoint } from 'payload'

import { handleResendWebhook } from '../lib/email/webhook'

/**
 * Payload-registered entry point for Resend delivery events. The logic lives in
 * `lib/email/webhook.ts` because a Next route handler at the same path shadows this one; see that
 * file for why.
 */
export const emailWebhookEndpoint: Endpoint = {
  path: '/email/webhook',
  method: 'post',
  handler: async (req) => {
    const rawBody = typeof req.text === 'function' ? await req.text() : ''

    const { status, body } = await handleResendWebhook(req.payload, rawBody, {
      id: req.headers.get('svix-id') ?? '',
      timestamp: req.headers.get('svix-timestamp') ?? '',
      signature: req.headers.get('svix-signature') ?? '',
    })

    return Response.json(body, { status })
  },
}

import config from '@payload-config'
import { getPayload } from 'payload'

import { handleResendWebhook } from '@/lib/email/webhook'

/**
 * Next route handler for Resend delivery events. This file shadows Payload's `[...slug]` catch-all,
 * so it — not `emailWebhookEndpoint` — is what actually serves `/api/email/webhook`. Both delegate to
 * the same handler.
 */
export async function POST(request: Request): Promise<Response> {
  const payload = await getPayload({ config })
  const rawBody = await request.text()

  const { status, body } = await handleResendWebhook(payload, rawBody, {
    id: request.headers.get('svix-id') ?? '',
    timestamp: request.headers.get('svix-timestamp') ?? '',
    signature: request.headers.get('svix-signature') ?? '',
  })

  return Response.json(body, { status })
}

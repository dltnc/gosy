import type { Payload } from 'payload'
import { Webhook as SvixWebhook } from 'svix'

import { resolveEmailWebhookSecret } from '../settings/integrations'
import { sendSms } from '../sms/smsBd.adapter'

/**
 * Resend delivery-webhook handling, shared by the Payload endpoint (`/api/email/webhook`) and the
 * Next route handler that shadows it.
 *
 * Next's explicit `app/(payload)/api/email/webhook/route.ts` takes precedence over Payload's
 * `[...slug]` catch-all, so whichever of the two is registered, only one of them can ever run for a
 * given request. Keeping the logic here means the two entry points cannot drift apart again —
 * previously one matched email-logs by recipient address and the other by Resend email id, and only
 * one of them sent the SMS fallback.
 *
 * Matching is by `resendEmailId`, which `sendTemplatedEmail` records at send time. Matching on the
 * recipient address instead would attach a bounce to whichever email that person was sent most
 * recently, which is frequently the wrong row.
 */

interface ResendWebhookEvent {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[]
    [key: string]: unknown
  }
}

const STATUS_BY_EVENT: Record<string, 'delivered' | 'bounced' | 'complained' | 'failed'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'send.failed': 'failed',
}

export interface WebhookResult {
  status: number
  body: Record<string, unknown>
}

function normalizeEmailId(value: unknown): string | undefined {
  const id = String(value ?? '').trim()
  if (!id) return undefined
  // Resend sometimes reports the id in Message-ID form.
  return id.replace(/^<|>$/g, '')
}

function bounceMessage(data: ResendWebhookEvent['data']): string {
  const bounce = (data as { bounce?: { message?: unknown } } | undefined)?.bounce
  return typeof bounce?.message === 'string' && bounce.message.trim() ? bounce.message : 'Bounced'
}

export async function handleResendWebhook(
  payload: Payload,
  rawBody: string,
  svixHeaders: { id: string; timestamp: string; signature: string },
): Promise<WebhookResult> {
  const secret = await resolveEmailWebhookSecret(payload)
  if (!secret) {
    return {
      status: 503,
      body: {
        error:
          'Email webhook is not configured. Add the Resend webhook signing secret under Integrations & Credentials, or set RESEND_WEBHOOK_SECRET.',
      },
    }
  }

  let event: ResendWebhookEvent
  try {
    const verified = new SvixWebhook(secret).verify(rawBody, {
      'svix-id': svixHeaders.id,
      'svix-timestamp': svixHeaders.timestamp,
      'svix-signature': svixHeaders.signature,
    })
    const json =
      typeof verified === 'string' ? verified : new TextDecoder().decode(verified as Uint8Array)
    event = JSON.parse(json) as ResendWebhookEvent
  } catch (err) {
    payload.logger.warn({
      msg: 'Resend webhook signature verification failed',
      err: err instanceof Error ? err : new Error(String(err)),
    })
    return { status: 401, body: { error: 'Invalid webhook signature.' } }
  }

  const emailId = normalizeEmailId(event.data?.email_id)
  if (!emailId) return { status: 200, body: { received: true, matched: false } }

  const { docs } = await payload.find({
    collection: 'email-logs',
    where: { resendEmailId: { equals: emailId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const log = docs[0]
  if (!log) return { status: 200, body: { received: true, matched: false } }

  const nextStatus = STATUS_BY_EVENT[event.type]
  // Resend can redeliver an event; only the first bounce should trigger the SMS fallback.
  const alreadyBounced = log.status === 'bounced'

  await payload.update({
    collection: 'email-logs',
    id: log.id,
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      lastEventAt: new Date().toISOString(),
      ...(event.type === 'email.bounced' ? { error: bounceMessage(event.data) } : {}),
    },
    overrideAccess: true,
    draft: false,
  })

  if (event.type === 'email.bounced' && !alreadyBounced && log.relatedBooking) {
    await sendBounceFallbackSms(payload, Number(log.relatedBooking), log.id)
  }

  return {
    status: 200,
    body: { received: true, matched: true, status: nextStatus ?? log.status },
  }
}

/**
 * A bounced confirmation means the guest has a booking they may not know about. SMS is the only other
 * channel we hold, so it is worth a best-effort attempt — but a failure here must not turn the
 * webhook into a 500, or Resend will keep retrying an event we already recorded.
 */
async function sendBounceFallbackSms(
  payload: Payload,
  bookingId: number,
  emailLogId: number | string,
): Promise<void> {
  try {
    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 1,
      overrideAccess: true,
      select: { bookingRef: true, guest: true },
    })

    const guest = typeof booking.guest === 'object' ? booking.guest : null
    if (!guest?.phone) return

    await sendSms({
      payload,
      to: guest.phone,
      message: `Heads up: your booking ${booking.bookingRef} is confirmed, but our confirmation email could not be delivered. Contact support if you did not receive it.`,
      purpose: 'booking_confirmation',
      relatedBooking: booking.id,
    })
  } catch (err) {
    payload.logger.error({
      msg: `SMS fallback after bounced email failed for email-log ${emailLogId}`,
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }
}

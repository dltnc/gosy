import type { Payload } from 'payload'
import type { ReactElement } from 'react'
import { render } from '@react-email/render'

export interface SendTemplateOptions {
  to: string
  subject: string
  element: ReactElement
  template?: string
  relatedBooking?: string | number
  attachments?: {
    filename: string
    content: Buffer
    contentType?: string
  }[]
}

function extractResendEmailId(result: unknown): string | undefined {
  if (!result || typeof result !== 'object' || !('messageId' in result)) return undefined
  const messageId = String((result as { messageId?: unknown }).messageId ?? '').trim()
  if (!messageId) return undefined
  return messageId.replace(/^<|>$/g, '')
}

export async function sendTemplatedEmail(
  payload: Payload,
  options: SendTemplateOptions,
): Promise<void> {
  const html = await render(options.element)

  try {
    const result = await payload.sendEmail({
      to: options.to,
      subject: options.subject,
      html,
      ...(options.attachments?.length ? { attachments: options.attachments } : {}),
    })

    await payload.create({
      collection: 'email-logs',
      data: {
        to: options.to,
        subject: options.subject,
        status: 'sent',
        ...(options.template ? { template: options.template } : {}),
        ...(options.relatedBooking != null
          ? { relatedBooking: Number(options.relatedBooking) }
          : {}),
        ...(extractResendEmailId(result)
          ? { resendEmailId: extractResendEmailId(result) }
          : {}),
        lastEventAt: new Date().toISOString(),
      },
      overrideAccess: true,
      draft: false,
    })
  } catch (err) {
    await payload
      .create({
        collection: 'email-logs',
        data: {
          to: options.to,
          subject: options.subject,
          status: 'failed',
          error: err instanceof Error ? err.message : String(err),
          ...(options.template ? { template: options.template } : {}),
          ...(options.relatedBooking != null
            ? { relatedBooking: Number(options.relatedBooking) }
            : {}),
        },
        overrideAccess: true,
        draft: false,
      })
      .catch(() => undefined)
    throw err
  }
}

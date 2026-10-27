import type { Payload, PayloadRequest } from 'payload'

import { resolveSmsConfig, type ResolvedSmsConfig } from '../settings/integrations'

export type SmsPurpose =
  | 'otp_verification'
  | 'booking_confirmation'
  | 'booking_cancellation'
  | 'payment_status'
  | 'partner_notification'

export interface SendSmsArgs {
  payload: Payload
  to: string
  message: string
  purpose: SmsPurpose
  relatedBooking?: string | number | null
  req?: PayloadRequest
}

export interface SendSmsResult {
  queued: boolean
  logId?: number
  gatewayRequestId?: string | null
  error?: string
}

export interface SmsReport {
  status: 'queued' | 'pending' | 'sent' | 'delivered' | 'failed' | 'unknown'
  raw?: unknown
}

interface SmsBdSendResponse {
  request_id?: string
  error_code?: number
  error_message?: string
}

/**
 * Credentials come from the `integration-settings` global, falling back to `SMS_BD_*` env vars.
 * Callers that have no meaningful way to react to a missing key (balance polling, delivery reports)
 * swallow the error and report "unknown"; send paths surface it on the SMS log row.
 */
async function requireConfig(payload: Payload): Promise<ResolvedSmsConfig> {
  const config = await resolveSmsConfig(payload)
  if (!config) {
    throw new Error(
      'SMS is not configured. Set the API key under Integrations & Credentials in the admin panel, or as SMS_BD_API_KEY.',
    )
  }
  return config
}

async function callSmsBd<T>(
  cfg: ResolvedSmsConfig,
  path: string,
  init?: { method?: string; body?: Record<string, unknown> },
): Promise<T> {
  const url = new URL(`${cfg.baseURL}${path}`)
  url.searchParams.set('api_key', cfg.apiKey)

  const res = await fetch(url.toString(), {
    method: init?.method ?? 'GET',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  })

  return (await res.json()) as T
}

export async function getSmsBalance(payload: Payload): Promise<number | null> {
  try {
    const data = await callSmsBd<{ balance?: number | string; error_message?: string }>(
      await requireConfig(payload),
      '/user/balance',
    )
    const balance = Number(data.balance)
    return Number.isFinite(balance) ? balance : null
  } catch {
    return null
  }
}

export async function getSmsDeliveryReport(
  payload: Payload,
  requestId: string,
): Promise<SmsReport> {
  try {
    const data = await callSmsBd<{
      status?: string
      delivery_status?: string
      error_message?: string
    }>(
      await requireConfig(payload),
      `/report/request/${encodeURIComponent(requestId)}/`,
    )

    const raw = String(data.delivery_status ?? data.status ?? '').toLowerCase()

    if (/deliver/i.test(raw)) return { status: 'delivered', raw: data }
    if (/sent|submit/i.test(raw)) return { status: 'sent', raw: data }
    if (/fail|reject|invalid/i.test(raw)) return { status: 'failed', raw: data }
    if (/queue|process|accept/i.test(raw)) return { status: 'pending', raw: data }

    return { status: 'unknown', raw: data }
  } catch {
    return { status: 'unknown' }
  }
}

export async function sendSms(args: SendSmsArgs): Promise<SendSmsResult> {
  const logRow = await args.payload.create({
    collection: 'sms-logs',
    data: {
      phone: args.to,
      message: args.message,
      purpose: args.purpose,
      deliveryStatus: 'queued',
      relatedBooking:
        args.relatedBooking != null ? Number(args.relatedBooking) : undefined,
      sentAt: new Date().toISOString(),
    },
    overrideAccess: true,
    draft: false,
    ...(args.req ? { req: args.req } : {}),
  })


  try {
    const cfg = await requireConfig(args.payload)
    const data = await callSmsBd<SmsBdSendResponse>(cfg, '/sendsms', {
      method: 'POST',
      body: {
        api_key: cfg.apiKey,
        sender_id: cfg.senderId,
        msisdn: args.to.replace(/[^\d+]/g, ''),
        message: args.message,
      },
    })

    if (data.request_id) {
      await args.payload.update({
        collection: 'sms-logs',
        id: logRow.id as number,
        data: {
          gatewayRequestId: data.request_id,
          deliveryStatus: 'pending',
        },
        overrideAccess: true,
        ...(args.req ? { req: args.req } : {}),
      })
      return { queued: true, logId: logRow.id as number, gatewayRequestId: data.request_id }
    }

    await args.payload.update({
      collection: 'sms-logs',
      id: logRow.id as number,
      data: {
        deliveryStatus: 'failed',
        errorCode: data.error_code,
        errorMessage: data.error_message ?? 'Unknown gateway error',
      },
      overrideAccess: true,
      ...(args.req ? { req: args.req } : {}),
    })
    return { queued: false, logId: logRow.id as number, error: data.error_message }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await args.payload
      .update({
        collection: 'sms-logs',
        id: logRow.id as number,
        data: { deliveryStatus: 'failed', errorMessage: message },
        overrideAccess: true,
        ...(args.req ? { req: args.req } : {}),
      })
      .catch(() => undefined)
    return { queued: false, logId: logRow.id as number, error: message }
  }
}

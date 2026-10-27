import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { incrementCounter } from './otp/store'

export interface RateLimitOptions {
  key: string
  limit: number
  windowSeconds: number
  message?: string
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<void> {
  const count = await incrementCounter(options.key, options.windowSeconds)
  if (count > options.limit) {
    throw new APIError(
      options.message ?? 'Too many requests. Please try again shortly.',
      429,
    )
  }
}

export function getClientIp(req: PayloadRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip')
}

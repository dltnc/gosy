import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'
import { saveOtp } from '../lib/otp/store'
import { enforceRateLimit, getClientIp } from '../lib/rateLimit'
import { sendSms } from '../lib/sms/smsBd.adapter'

const RESEND_WINDOW_SECONDS = 60
const DAILY_LIMIT = 10
const PER_IP_HOURLY_LIMIT = 20

export const usersSendOtpEndpoint: Endpoint = {
  path: '/send-otp',
  method: 'post',
  handler: async (req) => {
    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { phone?: string }
    const phone = body.phone?.replace(/[^\d+]/g, '')

    if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) {
      throw new APIError('A valid phone number is required.', 400)
    }

    await enforceRateLimit({
      key: `otp:rl:min:${phone}`,
      limit: 1,
      windowSeconds: RESEND_WINDOW_SECONDS,
      message: 'Please wait a minute before requesting another code.',
    })

    await enforceRateLimit({
      key: `otp:rl:day:${phone}`,
      limit: DAILY_LIMIT,
      windowSeconds: 86_400,
      message: 'Daily OTP limit reached for this number.',
    })

    const ip = getClientIp(req)
    if (ip) {
      await enforceRateLimit({
        key: `otp:rl:ip:${ip}`,
        limit: PER_IP_HOURLY_LIMIT,
        windowSeconds: 3_600,
        message: 'Too many verification codes requested. Try again later.',
      })
    }

    const code = String(Math.floor(100000 + Math.random() * 900000))
    await saveOtp(phone, code)

    const result = await sendSms({
      payload: req.payload,
      to: phone,
      message: `Your verification code is ${code}. It expires in 5 minutes.`,
      purpose: 'otp_verification',
      req,
    })

    if (!result.queued && process.env.NODE_ENV === 'production') {
      throw new APIError('Could not send the verification code. Try again shortly.', 502)
    }

    return Response.json({ sent: true, expiresInSeconds: 300 })
  },
}

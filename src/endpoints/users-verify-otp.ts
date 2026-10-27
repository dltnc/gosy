import crypto from 'crypto'
import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'
import { verifyOtp } from '../lib/otp/store'

interface VerifyBody {
  phone?: string
  code?: string
  name?: string
  email?: string
  password?: string
}

function randomPassword(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export const usersVerifyOtpEndpoint: Endpoint = {
  path: '/verify-otp',
  method: 'post',
  handler: async (req) => {
    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as VerifyBody
    const phone = body.phone?.replace(/[^\d+]/g, '')

    if (!phone || !body.code) {
      throw new APIError('phone and code are required.', 400)
    }

    const valid = await verifyOtp(phone, body.code)
    if (!valid) {
      throw new APIError('Invalid or expired code.', 401)
    }

    const providedEmail = body.email?.trim().toLowerCase()
    if (providedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(providedEmail)) {
      throw new APIError('A valid email address is required.', 400)
    }
    if (body.password != null && body.password.length > 0 && body.password.length < 6) {
      throw new APIError('Password must be at least 6 characters.', 400)
    }

    const { docs } = await req.payload.find({
      collection: 'users',
      where: { phone: { equals: phone } },
      limit: 1,
      depth: 0,
    })

    let user = docs[0]
    let isNewUser = false

    if (!user) {
      isNewUser = true
      const email = providedEmail || `otp-${crypto.randomBytes(8).toString('hex')}@phone.local`
      const password =
        body.password != null && body.password.length >= 6 ? body.password : randomPassword()

      try {
        user = await req.payload.create({
          collection: 'users',
          data: {
            email,
            password,
            role: 'guest',
            name: body.name ?? undefined,
            phone,
          },
          overrideAccess: true,
          draft: false,
        })
      } catch {
        throw new APIError(
          'That email is already registered. Try logging in instead.',
          409,
        )
      }

      // Sign the freshly created account in by setting the auth cookie on this request.
      await req.payload.login({
        collection: 'users',
        data: { email, password },
        depth: 0,
        req,
      })
    }

    return Response.json({
      verified: true,
      isNewUser,
      authenticated: isNewUser,
      userId: user.id,
    })
  },
}

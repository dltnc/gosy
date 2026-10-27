import type { Endpoint } from 'payload'
import { addDataAndFileToRequest, APIError } from 'payload'

interface BankTransferBody {
  bookingId?: number
  senderName?: string
  senderAccountNumber?: string
  transferReference?: string
  receipt?: number
  paidAt?: string
}

export const paymentsBankTransferEndpoint: Endpoint = {
  path: '/bank-transfer',
  method: 'post',
  handler: async (req) => {
    if (!req.user) throw new APIError('Authentication required.', 401)

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as BankTransferBody
    if (!body.bookingId) throw new APIError('bookingId is required.', 400)
    if (!body.transferReference) {
      throw new APIError('transferReference is required.', 400)
    }

    const booking = await req.payload.findByID({
      collection: 'bookings',
      id: body.bookingId,
      depth: 0,
      overrideAccess: false,
      user: req.user,
    })

    if (booking.status !== 'pending_payment') {
      throw new APIError(`This booking is ${booking.status} and cannot accept payments.`, 400)
    }

    const { totalDocs } = await req.payload.count({
      collection: 'payments',
      where: {
        and: [
          { booking: { equals: booking.id } },
          { gateway: { equals: 'bank_transfer' } },
          { status: { in: ['initiated', 'pending'] } },
        ],
      },
    })

    if (totalDocs > 0) {
      throw new APIError('A bank transfer submission is already awaiting verification.', 409)
    }

    const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })

    const payment = await req.payload.create({
      collection: 'payments',
      data: {
        purpose: 'booking_payment',
        gateway: 'bank_transfer',
        status: 'pending',
        amount: booking.pricing?.totalAmount ?? 0,
        currency: booking.currency ?? settings.currency ?? 'BDT',
        booking: booking.id,
        bankTransferDetails: {
          senderName: body.senderName ?? undefined,
          senderAccountNumber: body.senderAccountNumber ?? undefined,
          transferReference: body.transferReference,
          receipt: body.receipt ? Number(body.receipt) : undefined,
          paidAt: body.paidAt ?? undefined,
        },
      },
      overrideAccess: true,
      draft: false,
    })

    return Response.json({
      payment,
      message: 'Transfer details submitted. Awaiting verification by the platform.',
    })
  },
}

import type { TaskConfig } from 'payload'
import { generateInvoicePdf } from '../lib/invoices/generateInvoicePdf'
import { sendPaymentReceiptEmail } from '../lib/email/send'

export const generateAndSendInvoice: TaskConfig<'generateAndSendInvoice'> = {
  slug: 'generateAndSendInvoice',
  label: 'Generate & Send Invoice',
  inputSchema: [{ name: 'bookingId', type: 'number', required: true }],
  outputSchema: [
    { name: 'invoiceNumber', type: 'text' },
    { name: 'mediaId', type: 'number' },
    { name: 'emailedTo', type: 'text' },
  ],
  retries: 2,
  handler: async ({ req, input }) => {
    const bookingId = Number(input.bookingId)

    const booking = await req.payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 0,
      overrideAccess: true,
    })

    if (!booking.invoicePdf) {
      const { buffer, invoiceNumber } = await generateInvoicePdf(req.payload, bookingId)

      const guestId =
        typeof booking.guest === 'object' && booking.guest !== null ? booking.guest.id : booking.guest

      const media = await req.payload.create({
        collection: 'media',
        data: {
          purpose: ['invoice'],
          alt: `Invoice ${invoiceNumber}`,
          ...(guestId != null ? { uploadedBy: guestId } : {}),
        },
        file: {
          data: buffer,
          mimetype: 'application/pdf',
          name: `${invoiceNumber}.pdf`,
          size: buffer.byteLength,
        },
        overrideAccess: true,
        draft: false,
      })

      await req.payload.update({
        collection: 'bookings',
        id: bookingId,
        data: { invoicePdf: media.id },
        overrideAccess: true,
        context: { skipBookingSideEffects: true },
        draft: false,
      })

      const receipt = await sendPaymentReceiptEmail(req.payload, bookingId, {
        filename: `${invoiceNumber}.pdf`,
        content: buffer,
        contentType: 'application/pdf',
      })

      return { output: { invoiceNumber, mediaId: media.id as number, emailedTo: receipt } }
    }

    return { output: { invoiceNumber: `INV-${booking.bookingRef ?? booking.id}` } }
  },
}

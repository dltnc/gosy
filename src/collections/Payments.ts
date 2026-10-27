import type {
  Access,
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  Where,
} from 'payload'
import { APIError } from 'payload'
import { adminsOnly } from '../lib/access/predicates'
import { paymentsInitiateEndpoint } from '../endpoints/payments-initiate'
import { paymentsWebhookEndpoint } from '../endpoints/payments-webhook'
import { paymentsVerifyEndpoint } from '../endpoints/payments-verify'
import { paymentsBankTransferEndpoint } from '../endpoints/payments-bank-transfer'

const MANUAL_GATEWAYS = ['bank_transfer', 'manual']

function resolveId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    if (id != null) return id
  }
  return undefined
}

const cascadeOnSuccess: CollectionAfterChangeHook = async ({ doc, req, previousDoc, context }) => {
  if (context.skipPaymentCascade) return doc

  const becameSuccess = doc.status === 'success' && previousDoc?.status !== 'success'
  if (!becameSuccess) return doc

  if (doc.purpose === 'booking_payment') {
    const bookingId = resolveId(doc.booking)
    if (bookingId) {
      const booking = await req.payload.findByID({
        collection: 'bookings',
        id: bookingId,
        depth: 0,
      })
      if (booking.status === 'pending_payment') {
        await req.payload.update({
          collection: 'bookings',
          id: bookingId,
          data: { status: 'confirmed' },
          overrideAccess: true,
          context: { skipBookingSideEffects: true },
        })
      }

      try {
        await req.payload.jobs.queue({
          task: 'generateAndSendInvoice',
          input: { bookingId: Number(bookingId) },
        })
      } catch (err) {
        req.payload.logger.error({
          msg: `Failed to queue invoice generation for booking ${bookingId}`,
          err: err instanceof Error ? err : new Error(String(err)),
        })
      }
    }
  }

  if (doc.purpose === 'subscription_payment') {
    const subscriptionId = resolveId(doc.propertySubscription)
    if (subscriptionId) {
      const subscription = await req.payload.findByID({
        collection: 'property-subscriptions',
        id: subscriptionId,
        depth: 0,
      })
      if (subscription.status === 'pending_payment') {
        await req.payload.update({
          collection: 'property-subscriptions',
          id: subscriptionId,
          data: { status: 'active' },
          overrideAccess: true,
        })
      }
    }
  }

  return doc
}

const paymentsRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'partner') {
    const partnerScope: Where = {
      or: [
        { 'booking.property.partner': { equals: user.id } },
        { 'propertySubscription.property.partner': { equals: user.id } },
      ],
    }
    return partnerScope
  }
  const guestScope: Where = { 'booking.guest': { equals: user.id } }
  return guestScope
}

const enforceManualVerificationAndDefaults: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const statusChanged = operation === 'create' || !originalDoc || data.status !== originalDoc.status

  if (statusChanged && data.status === 'success') {
    // `access.create` is any authenticated user, because guests and partners legitimately create
    // `initiated`/`pending` rows through the checkout endpoints. Nothing else stopped them from
    // POSTing a row that was *already* successful, and `cascadeOnSuccess` would then confirm the
    // booking or activate the subscription — a partner could grant themselves a free featured
    // listing. Money may only become successful through a gateway verification, a webhook (both
    // updates with `overrideAccess`, no user attached) or an admin.
    if (operation === 'create' && req.user && req.user.role !== 'admin') {
      throw new APIError(
        'A payment cannot be created as already successful. Pay through a gateway or submit a transfer for verification.',
        403,
      )
    }
    if (MANUAL_GATEWAYS.includes(data.gateway)) {
      // Only an admin verifies a slip, so only an admin is auto-stamped as the verifier. A partner
      // confirming their own bank transfer is exactly the thing this collection has to prevent.
      if (!data.verifiedBy && req.user?.role === 'admin') {
        data.verifiedBy = req.user.id
      }
      if (!data.verifiedBy) {
        throw new APIError(
          'Bank transfer and manual payments require a verifier before being marked as successful.',
          400,
        )
      }
      if (!data.verifiedAt) {
        data.verifiedAt = new Date().toISOString()
      }
    }
    if (!data.amount || data.amount <= 0) {
      throw new APIError('A successful payment must have a positive amount.', 400)
    }
  }

  if (operation === 'update' && data.status && originalDoc) {
    if (['failed', 'cancelled'].includes(originalDoc.status) && data.status === 'success') {
      throw new APIError(`Cannot move a payment from ${originalDoc.status} back to success.`, 400)
    }
  }

  return data
}

export const Payments: CollectionConfig = {
  slug: 'payments',
  endpoints: [
    paymentsInitiateEndpoint,
    paymentsWebhookEndpoint,
    paymentsVerifyEndpoint,
    paymentsBankTransferEndpoint,
  ],
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['purpose', 'gateway', 'amount', 'status', 'booking', 'createdAt'],
    group: 'Transactions',
    description:
      'Created through payment endpoints/webhooks. Gateway adapters are wired in lib/payments.',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: paymentsRead,
    update: ({ req: { user } }) => {
      if (user?.role !== 'admin') return false
      const editableScope: Where = { status: { in: ['initiated', 'pending'] } }
      return editableScope
    },
    delete: adminsOnly,
  },
  hooks: {
    beforeChange: [enforceManualVerificationAndDefaults],
    afterChange: [cascadeOnSuccess],
  },
  fields: [
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: [
        { label: 'Booking Payment', value: 'booking_payment' },
        { label: 'Subscription Payment', value: 'subscription_payment' },
        { label: 'Refund', value: 'refund' },
      ],
      index: true,
    },
    {
      name: 'gateway',
      type: 'select',
      required: true,
      options: [
        { label: 'bKash', value: 'bkash' },
        { label: 'Nagad', value: 'nagad' },
        { label: 'SSLCommerz', value: 'sslcommerz' },
        { label: 'AmarPay', value: 'aamarpay' },
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Manual / Cash', value: 'manual' },
      ],
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'initiated',
      options: [
        { label: 'Initiated', value: 'initiated' },
        { label: 'Pending', value: 'pending' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Refunded', value: 'refunded' },
      ],
      index: true,
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'BDT',
      admin: { position: 'sidebar' },
    },
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'bookings',
      index: true,
      admin: {
        condition: (data) => !data.purpose || data.purpose === 'booking_payment',
      },
      maxDepth: 0,
    },
    {
      name: 'propertySubscription',
      type: 'relationship',
      relationTo: 'property-subscriptions',
      index: true,
      admin: {
        condition: (data) => data.purpose === 'subscription_payment',
      },
      maxDepth: 0,
    },
    {
      name: 'transactionId',
      label: 'Gateway Transaction ID',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'gatewayRequestId',
      type: 'text',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'gatewayMetadata',
      type: 'json',
      admin: {
        position: 'sidebar',
        description: 'Raw gateway response payload, kept for reconciliation and disputes.',
      },
    },
    {
      name: 'bankTransferDetails',
      type: 'group',
      admin: {
        condition: (data) => data.gateway === 'bank_transfer',
      },
      fields: [
        { name: 'senderName', type: 'text' },
        { name: 'senderAccountNumber', type: 'text' },
        { name: 'transferReference', type: 'text' },
        {
          name: 'receipt',
          type: 'upload',
          relationTo: 'media',
          filterOptions: {
            purpose: { contains: 'payment_proof' },
          },
        },
        { name: 'paidAt', type: 'date' },
      ],
    },
    {
      name: 'verifiedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        // Not `access: { update: () => false }`: the collection `beforeChange` above runs *before*
        // the field-level traversal, so a field the hook writes and access then rejects would be
        // silently reverted to its stored value. Read-only in the panel, hook-owned in the API.
        readOnly: true,
        condition: (data) => data.gateway === 'bank_transfer' || data.gateway === 'manual',
      },
      filterOptions: { role: { in: ['admin', 'partner'] } },
    },
    {
      name: 'verifiedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        readOnly: true,
        condition: (data) => data.gateway === 'bank_transfer' || data.gateway === 'manual',
      },
    },
    {
      name: 'refundedAmount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: { position: 'sidebar' },
    },
  ],
}

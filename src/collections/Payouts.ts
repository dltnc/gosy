import type {
  Access,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  Where,
} from 'payload'
import { APIError } from 'payload'

import { adminFieldOnly, adminsOnly, adminsOrPartners } from '../lib/access/predicates'
import { getPartnerPayoutSummary, type PayoutStatus } from '../lib/payouts/earnings'

/**
 * Money leaving the platform towards a partner.
 *
 * Deliberately a record of an *out-of-band* transfer rather than an integration: the platform never
 * calls a disbursement API. A partner asks for an amount, an admin sends it by bKash/Nagad/bank
 * however they normally would, then marks the row paid with the reference from that transfer. So the
 * value of this collection is the audit trail — who asked for what, against which balance, who
 * approved it, and what reference proves it moved.
 *
 * Amount, destination and requester are frozen after creation for that reason. Correcting a mistake
 * means rejecting the row and posting a new one, never editing history.
 */

const TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  // `requested → paid` is allowed directly: a small platform often just sends the money, and forcing
  // a click through `approved` would only train admins to click twice.
  requested: ['approved', 'processing', 'paid', 'rejected'],
  approved: ['processing', 'paid', 'rejected'],
  processing: ['paid', 'rejected'],
  paid: [],
  rejected: [],
}

function resolveId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    if (id != null) return id
  }
  return undefined
}

const payoutsRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const ownScope: Where = { partner: { equals: user.id } }
  return ownScope
}

/**
 * Everything a request must be true about at the moment it is filed.
 *
 * This lives in a hook rather than in the request endpoint because the partner dashboard writes
 * through the ordinary REST route. Anything a form can reach, a crafted `POST /api/payouts` can
 * reach too, so the balance check has to sit where both pass through.
 */
const stampAndValidateRequest: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (!data || operation !== 'create') return data

  const isAdmin = req.user?.role === 'admin'
  // A partner may only ever request for itself, so `partner` is not a choice on that route.
  const partnerId = isAdmin ? (resolveId(data.partner) ?? req.user?.id) : req.user?.id
  if (partnerId == null) throw new APIError('A payout needs a partner.', 400)
  data.partner = partnerId

  if (!isAdmin) data.status = 'requested'
  data.requestedAt = data.requestedAt ?? new Date().toISOString()

  const amount = Number(data.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new APIError('Enter a payout amount greater than zero.', 400)
  }
  data.amount = Math.round(amount * 100) / 100

  const partner = await req.payload.findByID({
    collection: 'users',
    id: partnerId,
    depth: 0,
    overrideAccess: true,
  })
  const profile = partner.partnerProfile ?? {}
  const bank = profile.bankDetails ?? {}

  // Snapshot where the money is going. A partner who later edits their account number must not
  // rewrite the destination of a transfer that has already been sent.
  data.method = data.method ?? profile.payoutMethod
  if (!data.method) {
    throw new APIError('Save a payout method on your profile before requesting a payout.', 400)
  }
  data.destination = {
    accountNumber:
      data.method === 'bank' ? (bank.accountNumber ?? null) : (profile.payoutAccountNumber ?? null),
    accountName: bank.accountName ?? null,
    bankName: data.method === 'bank' ? (bank.bankName ?? null) : null,
    branchName: data.method === 'bank' ? (bank.branchName ?? null) : null,
    routingNumber: data.method === 'bank' ? (bank.routingNumber ?? null) : null,
  }
  if (!data.destination.accountNumber) {
    throw new APIError(
      'Save the account number for your payout method before requesting a payout.',
      400,
    )
  }

  const summary = await getPartnerPayoutSummary(req.payload, partnerId)
  data.balanceAtRequest = summary.available
  // Admins are exempt so a goodwill payment or a correction is still possible; a partner is not.
  if (!isAdmin && data.amount > summary.available) {
    throw new APIError(
      `You can request up to ৳${summary.available.toLocaleString('en-US')} right now.`,
      400,
    )
  }

  return data
}

/**
 * The only path a status may take, plus the evidence each step demands.
 *
 * `processedBy`/`processedAt` are stamped here rather than trusted from the request, so the audit
 * trail records who actually clicked, and a crafted value cannot claim someone else approved it.
 */
const guardTransitions: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !originalDoc) return data

  const from = originalDoc.status as PayoutStatus
  const to = (data.status ?? from) as PayoutStatus
  if (to === from) return data

  if (req.user?.role !== 'admin') {
    throw new APIError('Only an admin can change the status of a payout.', 403)
  }
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new APIError(`A ${from} payout cannot become ${to}.`, 400)
  }

  data.processedAt = new Date().toISOString()
  data.processedBy = req.user.id

  if (to === 'paid') {
    const reference = String(data.reference ?? originalDoc.reference ?? '').trim()
    if (!reference) {
      // The reference is the whole point of marking it paid — without it there is nothing to
      // reconcile against the bank or bKash statement when the partner says they never received it.
      throw new APIError('Record the transfer reference before marking a payout as paid.', 400)
    }
    data.reference = reference
    data.paidAt = data.paidAt ?? new Date().toISOString()
  }

  if (to === 'rejected') {
    const reason = String(data.adminNotes ?? originalDoc.adminNotes ?? '').trim()
    if (!reason) {
      throw new APIError('Add an admin note explaining why this payout was rejected.', 400)
    }
  }

  return data
}

export const Payouts: CollectionConfig = {
  slug: 'payouts',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['partner', 'amount', 'status', 'method', 'requestedAt', 'paidAt'],
    group: 'Transactions',
    description:
      'Partner payout requests. Send the money through your normal bKash/Nagad/bank channel, then set the status to Paid and record the transfer reference. Amount and destination are frozen — reject and ask for a new request instead of editing one.',
  },
  access: {
    create: adminsOrPartners,
    read: payoutsRead,
    update: adminsOnly,
    // Rejecting keeps the history; deleting would make a balance impossible to audit.
    delete: () => false,
  },
  hooks: {
    beforeValidate: [stampAndValidateRequest],
    beforeChange: [guardTransitions],
  },
  fields: [
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      filterOptions: { role: { in: ['partner', 'admin'] } },
      access: { update: () => false },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Net of commission — the platform never re-derives this from bookings.',
      },
      access: { update: () => false },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'requested',
      index: true,
      options: [
        { label: 'Requested', value: 'requested' },
        { label: 'Approved', value: 'approved' },
        { label: 'Processing', value: 'processing' },
        { label: 'Paid', value: 'paid' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'method',
      type: 'select',
      required: true,
      options: [
        { label: 'bKash', value: 'bkash' },
        { label: 'Nagad', value: 'nagad' },
        { label: 'Bank Transfer', value: 'bank' },
      ],
      access: { update: () => false },
    },
    {
      name: 'destination',
      type: 'group',
      admin: {
        description: 'Copied from the partner profile when the request was filed.',
      },
      access: { update: () => false },
      fields: [
        { name: 'accountNumber', type: 'text' },
        { name: 'accountName', type: 'text' },
        { name: 'bankName', type: 'text' },
        { name: 'branchName', type: 'text' },
        { name: 'routingNumber', type: 'text' },
      ],
    },
    {
      name: 'balanceAtRequest',
      type: 'number',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Available balance the moment this request was filed, for later reconciliation.',
      },
    },
    {
      name: 'requestedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
      access: { update: () => false },
    },
    {
      name: 'reference',
      label: 'Transfer Reference',
      type: 'text',
      index: true,
      admin: {
        description:
          'Transaction ID or bank reference. Required before a payout can be marked paid.',
      },
    },
    {
      name: 'paidAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'processedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'processedBy',
      type: 'relationship',
      relationTo: 'users',
      filterOptions: { role: { equals: 'admin' } },
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'notes',
      label: 'Partner Note',
      type: 'textarea',
      access: { update: () => false },
    },
    {
      name: 'adminNotes',
      type: 'textarea',
      access: { read: adminFieldOnly },
      admin: { description: 'Internal. Required when rejecting a request.' },
    },
  ],
}

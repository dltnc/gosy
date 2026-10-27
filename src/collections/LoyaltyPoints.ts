import type { Access, CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { adminsOnly, readOnlyField } from '../lib/access/predicates'
import { recomputeUserPointsBalance } from '../lib/loyalty/ledger'

const syncUserBalance: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  const raw = doc.user as string | number | { id?: string | number } | null | undefined
  const userId = typeof raw === 'object' && raw !== null ? raw.id : raw
  if (userId == null) return doc
  await recomputeUserPointsBalance(req.payload, userId, req)
  return doc
}

const loyaltyRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const ownScope = { user: { equals: user.id } }
  return ownScope
}

export const LoyaltyPoints: CollectionConfig = {
  slug: 'loyalty-points',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'type', 'amount', 'sourceBooking', 'expiresAt', 'createdAt'],
    group: 'Growth',
    description:
      'Append-only points ledger. Never edit or delete rows — post an offsetting entry instead. Rows are created by booking hooks or by admins for manual adjustments.',
  },
  hooks: {
    afterChange: [syncUserBalance],
  },
  access: {
    create: adminsOnly,
    read: loyaltyRead,
    update: readOnlyField,
    delete: () => false,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Earned', value: 'earn' },
        { label: 'Redeemed', value: 'redeem' },
        { label: 'Expired', value: 'expire' },
        { label: 'Reversed', value: 'reverse' },
        { label: 'Manual Adjustment', value: 'adjust' },
      ],
      access: { update: () => false },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description:
          'Signed value — positive adds to the balance (earn), negative subtracts (redeem, expire, reverse).',
      },
      access: { update: () => false },
    },
    {
      name: 'sourceBooking',
      type: 'relationship',
      relationTo: 'bookings',
      index: true,
      access: { update: () => false },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly' },
        condition: (data) => !data.type || data.type === 'earn',
      },
      access: { update: () => false },
    },
    {
      name: 'notes',
      type: 'textarea',
      access: { update: () => false },
    },
  ],
}

import type {
  Access,
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
} from 'payload'
import { APIError } from 'payload'
import { adminsOnly } from '../lib/access/predicates'
import { subscriptionCheckoutEndpoint } from '../endpoints/subscription-checkout'
import { sendSubscriptionActivatedEmail } from '../lib/email/send'

function resolveId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    if (id != null) return id
  }
  return undefined
}

const subscriptionsRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const ownScope = { 'property.partner': { equals: user.id } }
  return ownScope
}

const activateAndSetDates: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (operation === 'create' && !data.property) {
    throw new APIError('A property is required for a subscription.', 400)
  }

  const becameActive = data.status === 'active' && originalDoc?.status !== 'active'

  if (becameActive) {
    const planId = resolveId(data.plan) ?? resolveId(originalDoc?.plan)
    if (!planId) throw new APIError('A plan is required to activate a subscription.', 400)

    const plan = await req.payload.findByID({
      collection: 'subscription-plans',
      id: planId,
      depth: 0,
    })

    if (!plan.active) {
      throw new APIError('This plan is no longer available.', 400)
    }

    const startDate = data.startDate ?? originalDoc?.startDate ?? new Date().toISOString()
    const endDate =
      data.endDate ??
      (() => {
        const d = new Date(startDate)
        d.setDate(d.getDate() + plan.durationDays)
        return d.toISOString()
      })()

    data.startDate = startDate
    data.endDate = endDate
  }

  return data
}

const copyBenefitsToProperty: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  previousDoc,
}) => {
  const propertyId = resolveId(doc.property)
  if (!propertyId) return doc

  if (operation === 'update' && doc.status === 'active' && previousDoc.status !== 'active') {
    const planId = resolveId(doc.plan)!
    const plan = await req.payload.findByID({
      collection: 'subscription-plans',
      id: planId,
      depth: 0,
    })

    await req.payload.update({
      collection: 'properties',
      id: propertyId,
      data: {
        isFeatured: plan.benefits.isFeatured ?? true,
        featuredPriority: plan.benefits.priorityScore,
        featuredUntil: doc.endDate,
      },
      overrideAccess: true,
      context: { skipSubscriptionHooks: true },
    })

    await sendSubscriptionActivatedEmail(req.payload, doc.id)
  }

  if (operation === 'update' && previousDoc.status === 'active' && doc.status !== 'active') {
    await req.payload.update({
      collection: 'properties',
      id: propertyId,
      data: {
        isFeatured: false,
        featuredPriority: 0,
        featuredUntil: null,
      },
      overrideAccess: true,
      context: { skipSubscriptionHooks: true },
    })
  }

  return doc
}

export const PropertySubscriptions: CollectionConfig = {
  slug: 'property-subscriptions',
  endpoints: [subscriptionCheckoutEndpoint],
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['property', 'plan', 'status', 'startDate', 'endDate'],
    group: 'Growth',
    description:
      'Created through the checkout endpoint. Activation copies the plan benefits onto the property; expiry resets them (daily job).',
  },
  access: {
    // Partners buy through `/api/property-subscriptions/checkout`, which writes with
    // `overrideAccess` after reading the price from the plan. Direct creates stay admin-only so a
    // partner cannot park a `pending_payment` row on a property and skip the priced path.
    create: adminsOnly,
    read: subscriptionsRead,
    update: adminsOnly,
    delete: adminsOnly,
  },
  hooks: {
    beforeChange: [activateAndSetDates],
    afterChange: [copyBenefitsToProperty],
  },
  fields: [
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      required: true,
      index: true,
      access: { update: () => false },
      filterOptions: ({ user }) => {
        if (!user?.id || user.role === 'admin') return true
        const ownScope = { partner: { equals: user.id } }
        return ownScope
      },
    },
    {
      name: 'plan',
      type: 'relationship',
      relationTo: 'subscription-plans',
      required: true,
      index: true,
      access: { update: () => false },
      filterOptions: { active: { equals: true } },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending_payment',
      options: [
        { label: 'Pending Payment', value: 'pending_payment' },
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      index: true,
    },
    {
      name: 'startDate',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayOnly' } },
      access: { update: () => false },
    },
    {
      name: 'endDate',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayOnly' } },
      access: { update: () => false },
    },
  ],
}

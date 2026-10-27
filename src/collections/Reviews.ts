import type {
  Access,
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  FieldAccess,
  Where,
} from 'payload'
import { APIError } from 'payload'
import { adminsOnly, adminFieldOnly } from '../lib/access/predicates'

const guestOnlyWrite: { update: FieldAccess } = {
  update: ({ req }: { req: { user?: { role?: string } | null } }) =>
    req.user?.role !== 'partner',
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

const deriveFromBooking: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (operation !== 'create') return data

  const bookingId = resolveId(data.booking)
  if (!bookingId) throw new APIError('A booking is required to leave a review.', 400)

  const booking = await req.payload.findByID({
    collection: 'bookings',
    id: bookingId,
    depth: 0,
    overrideAccess: true,
  })

  if (req.user?.role !== 'admin') {
    if (booking.guest && resolveId(booking.guest) !== req.user?.id) {
      throw new APIError('You can only review your own stays.', 403)
    }
  }

  if (booking.status !== 'checked_out') {
    throw new APIError('You can review a property after your stay is completed.', 400)
  }

  data.guest = resolveId(booking.guest)!
  data.property = resolveId(booking.property)!
  data.status = 'published'

  return data
}

const preventDuplicateReview: CollectionBeforeOperationHook = async ({
  args,
  operation,
  req,
}) => {
  if (operation === 'create') {
    const data = (args as { data?: Record<string, unknown> }).data
    const bookingId = resolveId(data?.booking)
    if (bookingId) {
      const { totalDocs } = await req.payload.count({
        collection: 'reviews',
        where: { booking: { equals: bookingId } },
      })
      if (totalDocs > 0) {
        throw new APIError('This stay has already been reviewed.', 409)
      }
    }
  }
}

const recomputePropertyRating: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  if (context.skipReviewAggregation) return doc

  const propertyId = resolveId(doc.property)
  if (!propertyId) return doc

  const reviews = await req.payload.find({
    collection: 'reviews',
    where: { property: { equals: propertyId } },
    limit: 0,
    depth: 0,
    select: { rating: true },
    overrideAccess: true,
  })

  const count = reviews.totalDocs
  const avg =
    count === 0 ? 0 : reviews.docs.reduce((sum, r) => sum + (r.rating ?? 0), 0) / count

  await req.payload.update({
    collection: 'properties',
    id: propertyId,
    data: { avgRating: Math.round(avg * 10) / 10, reviewCount: count },
    context: { skipHooks: true },
    overrideAccess: true,
  })

  return doc
}

const reviewsUpdate: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'partner') {
    const ownScope: Where = { 'property.partner': { equals: user.id } }
    return ownScope
  }
  return false
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['property', 'guest', 'rating', 'status', 'createdAt'],
    group: 'Trust',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: () => true,
    update: reviewsUpdate,
    delete: adminsOnly,
  },
  hooks: {
    beforeChange: [deriveFromBooking],
    beforeOperation: [preventDuplicateReview],
    afterChange: [recomputePropertyRating],
  },
  fields: [
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'bookings',
      required: true,
      unique: true,
      index: true,
      access: { update: adminFieldOnly as FieldAccess },
    },
    {
      name: 'guest',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
      access: { update: () => false },
    },
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      required: true,
      index: true,
      admin: { readOnly: true, position: 'sidebar' },
      access: { update: () => false },
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      validate: (value: number | number[] | null | undefined) =>
        (!Array.isArray(value) &&
          value != null &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 5) ||
        'Rating must be a whole number between 1 and 5.',
      access: guestOnlyWrite,
    },
    {
      name: 'cleanlinessRating',
      type: 'number',
      min: 1,
      max: 5,
      access: guestOnlyWrite,
    },
    {
      name: 'locationRating',
      type: 'number',
      min: 1,
      max: 5,
      access: guestOnlyWrite,
    },
    {
      name: 'serviceRating',
      type: 'number',
      min: 1,
      max: 5,
      access: guestOnlyWrite,
    },
    {
      name: 'title',
      type: 'text',
      maxLength: 120,
      access: guestOnlyWrite,
    },
    {
      name: 'comment',
      type: 'textarea',
      maxLength: 2000,
      access: guestOnlyWrite,
    },
    {
      name: 'partnerReply',
      label: "Partner's Reply",
      type: 'textarea',
      access: {
        update: ({ req: { user } }) => Boolean(user),
      },
    },
    {
      name: 'repliedAt',
      type: 'date',
      admin: { position: 'sidebar', readOnly: true },
      access: { update: () => false },
      hooks: {
        beforeChange: [
          ({ operation, siblingData, value }) =>
            operation === 'update' && siblingData?.partnerReply
              ? new Date().toISOString()
              : value ?? undefined,
        ],
      },
    },
  ],
}

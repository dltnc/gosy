import type {
  Access,
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  TextField,
  Where,
} from 'payload'
import { slugField } from 'payload'
import { adminsOnly, adminFieldOnly } from '../lib/access/predicates'
import { parseYouTubeId } from '../lib/media/youtube'
import { deletePropertyFromIndex, indexPropertyById } from '../lib/search/indexProperty'
import { sendPropertyDecisionEmail } from '../lib/email/send'

export const PROPERTY_STATUSES = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending Review', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Suspended', value: 'suspended' },
]

export const PROPERTY_TYPES = [
  { label: 'Hotel', value: 'hotel' },
  { label: 'Resort', value: 'resort' },
]

export const PROPERTY_TIERS = [
  { label: 'Budget', value: 'budget' },
  { label: 'Standard', value: 'standard' },
  { label: 'Premium', value: 'premium' },
  { label: 'Flagship', value: 'flagship' },
]

export const TRUST_BADGES = [
  { label: 'Platform-Serviced', value: 'platform_serviced' },
  { label: 'Listing Network', value: 'listing_network' },
  { label: 'New Listing', value: 'new_listing' },
  { label: 'Free Cancellation', value: 'free_cancellation' },
  { label: 'Breakfast Included', value: 'breakfast_included' },
  { label: 'Flagged', value: 'flagged' },
]

const propertiesRead: Access = ({ req: { user } }) => {
  if (!user) {
    const publicScope: Where = { status: { equals: 'approved' } }
    return publicScope
  }
  if (user.role === 'admin') return true
  if (user.role === 'partner') {
    const partnerScope: Where = {
      or: [{ status: { equals: 'approved' } }, { partner: { equals: user.id } }],
    }
    return partnerScope
  }
  const publicScope: Where = { status: { equals: 'approved' } }
  return publicScope
}

const propertiesUpdate: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'partner') {
    const ownScope: Where = { partner: { equals: user.id } }
    return ownScope
  }
  return false
}

const syncSearchIndexAfterChange: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  previousDoc,
  context,
}) => {
  if (context.skipHooks) return doc

  try {
    await indexPropertyById(req.payload, Number(doc.id))
  } catch (err) {
    req.payload.logger.error({
      msg: `Search index update failed for property ${doc.id}`,
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }

  const becameApproved =
    operation === 'update' && doc.status === 'approved' && previousDoc.status !== 'approved'
  const becameRejected =
    operation === 'update' && doc.status === 'rejected' && previousDoc.status !== 'rejected'

  if (becameApproved || becameRejected) {
    await sendPropertyDecisionEmail(
      req.payload,
      { id: Number(doc.id), name: doc.name, status: doc.status },
      becameApproved ? 'approved' : 'rejected',
    )
  }

  return doc
}

const removeFromSearchIndexAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  await deletePropertyFromIndex(Number(doc.id))
  return doc
}

export const Properties: CollectionConfig = {
  slug: 'properties',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'status', 'propertyType', 'tier', 'isFeatured', 'avgRating'],
    group: 'Inventory',
    listSearchableFields: ['name', 'city', 'slug'],
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'partner',
    read: propertiesRead,
    update: propertiesUpdate,
    delete: adminsOnly,
  },
  hooks: {
    afterChange: [syncSearchIndexAfterChange],
    afterDelete: [removeFromSearchIndexAfterDelete],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    slugField({
      useAsSlug: 'name',
      position: 'sidebar',
      overrides: (field) => {
        const slug = field.fields[0]
        if (slug && 'name' in slug && slug.name === 'slug') {
          ;(slug as TextField).unique = true
          ;(slug as TextField).index = true
        }
        return field
      },
    }),
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'partner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: {
        create: ({ req: { user } }) => user?.role === 'admin',
        update: adminFieldOnly,
      },
      hooks: {
        beforeChange: [
          ({ req, operation, value }) => {
            if (operation === 'create' && !value && req.user?.role === 'partner') {
              return req.user.id
            }
            return value
          },
        ],
      },
      filterOptions: ({ user }) => {
        if (!user?.id || user.role === 'admin') return true
        const ownScope = { id: { equals: user.id }, role: { equals: 'partner' as const } }
        return ownScope
      },
    },
    {
      name: 'status',
      type: 'select',
      options: PROPERTY_STATUSES,
      defaultValue: 'draft',
      index: true,
      access: {
        update: adminFieldOnly,
        create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'partner',
      },
      admin: {
        position: 'sidebar',
        description: 'Lifecycle is admin-controlled. Only approved properties are publicly visible.',
      },
    },
    {
      name: 'propertyType',
      label: 'Property Type',
      type: 'select',
      options: PROPERTY_TYPES,
      defaultValue: 'hotel',
      index: true,
    },
    {
      name: 'tier',
      type: 'select',
      options: PROPERTY_TIERS,
      defaultValue: 'standard',
      index: true,
    },
    {
      name: 'starRating',
      type: 'number',
      min: 1,
      max: 5,
      validate: (value: unknown) =>
        value == null ||
        (typeof value === 'number' &&
          Number.isInteger(value) &&
          value >= 1 &&
          value <= 5) ||
        'Star rating must be a whole number between 1 and 5.',
    },
    {
      name: 'amenities',
      type: 'relationship',
      relationTo: 'amenities',
      hasMany: true,
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      filterOptions: {
        purpose: { contains: 'property_photo' },
      },
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          filterOptions: {
            purpose: { contains: 'property_photo' },
          },
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
    },
    {
      name: 'videos',
      type: 'array',
      labels: { singular: 'Video', plural: 'Videos' },
      admin: {
        description:
          'YouTube links shown alongside the photos on the listing page. Watch, share, embed and Shorts URLs all work.',
      },
      fields: [
        {
          name: 'url',
          type: 'text',
          required: true,
          // Validated at the field so the rule holds for the admin panel and the partner form alike —
          // both write through the same REST endpoint. The frontend rebuilds the embed URL from the
          // extracted id, so anything that is not a YouTube video is rejected here rather than being
          // sanitised later.
          validate: (value: string | null | undefined) =>
            parseYouTubeId(value) ? true : 'Enter a YouTube video link, e.g. youtube.com/watch?v=…',
          admin: {
            placeholder: 'https://www.youtube.com/watch?v=…',
          },
        },
        {
          name: 'title',
          type: 'text',
          admin: {
            description: 'Shown as the caption. Falls back to the property name.',
          },
        },
      ],
    },
    {
      name: 'address',
      type: 'group',
      fields: [
        {
          name: 'streetAddress',
          type: 'text',
        },
        {
          name: 'area',
          type: 'text',
        },
        {
          name: 'city',
          type: 'text',
          required: true,
          index: true,
        },
        {
          name: 'postcode',
          type: 'text',
        },
        {
          name: 'country',
          type: 'text',
          defaultValue: 'Bangladesh',
        },
      ],
    },
    {
      name: 'locality',
      type: 'relationship',
      relationTo: 'localities',
      filterOptions: (data) => {
        const city = (data as { siblingData?: { address?: { city?: string } } }).siblingData
          ?.address?.city
        return city ? { city: { equals: city } } : true
      },
    },
    {
      name: 'location',
      type: 'point',
      label: 'Map Location',
      admin: {
        position: 'sidebar',
        description: '[longitude, latitude]',
      },
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
      ],
    },
    {
      name: 'policies',
      type: 'group',
      fields: [
        { name: 'checkInTime', type: 'text', defaultValue: '14:00' },
        { name: 'checkOutTime', type: 'text', defaultValue: '12:00' },
        { name: 'cancellationPolicy', type: 'textarea' },
      ],
    },
    {
      name: 'commissionRateOverride',
      type: 'number',
      min: 0,
      max: 100,
      admin: {
        position: 'sidebar',
        description: 'Admin-only. Overrides the platform default commission rate for this property.',
      },
      access: {
        update: adminFieldOnly,
        create: adminFieldOnly,
      },
    },
    {
      name: 'trustBadges',
      type: 'select',
      hasMany: true,
      options: TRUST_BADGES,
      admin: {
        position: 'sidebar',
        description: 'Managed by admins and scheduled jobs.',
      },
      access: {
        update: adminFieldOnly,
      },
    },
    {
      name: 'flaggedWarningNote',
      type: 'textarea',
      admin: {
        condition: (data) => Boolean(data?.trustBadges?.includes('flagged')),
        description: 'Guest-facing warning shown on flagged properties.',
      },
      access: {
        update: adminFieldOnly,
      },
    },
    {
      name: 'socialProof',
      type: 'group',
      admin: {
        position: 'sidebar',
        description: 'Recomputed by a scheduled job — never updated per-booking.',
      },
      access: {
        update: adminFieldOnly,
      },
      fields: [
        {
          name: 'bookingsToday',
          type: 'number',
          defaultValue: 0,
        },
        {
          name: 'bookingsLast6Hours',
          type: 'number',
          defaultValue: 0,
        },
      ],
    },
    {
      name: 'isFeatured',
      label: 'Featured Placement',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Set automatically when a property subscription activates.',
      },
      access: {
        update: adminFieldOnly,
      },
    },
    {
      name: 'featuredPriority',
      type: 'number',
      defaultValue: 0,
      admin: {
        position: 'sidebar',
        description: 'Search ranking weight from the active subscription plan tier.',
      },
      access: {
        update: adminFieldOnly,
      },
    },
    {
      name: 'featuredUntil',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayOnly' },
      },
      access: {
        update: adminFieldOnly,
      },
    },
    {
      name: 'avgRating',
      label: 'Average Rating',
      type: 'number',
      min: 0,
      max: 5,
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Recomputed automatically from published reviews.',
      },
      access: {
        update: adminFieldOnly,
      },
    },
    {
      name: 'reviewCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
      },
      access: {
        update: adminFieldOnly,
      },
    },
  ],
}

import type {
  Access,
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  Where,
} from 'payload'
import { adminsOnly, adminFieldOnly } from '../lib/access/predicates'
import { indexPropertyById } from '../lib/search/indexProperty'

const roomTypesRead: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'partner') {
    const partnerScope: Where = {
      or: [
        {
          and: [{ isActive: { equals: true } }, { 'property.status': { equals: 'approved' } }],
        },
        { 'property.partner': { equals: user.id } },
      ],
    }
    return partnerScope
  }
  const publicScope: Where = {
    and: [{ isActive: { equals: true } }, { 'property.status': { equals: 'approved' } }],
  }
  return publicScope
}

const roomTypesUpdate: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'partner') {
    const ownScope: Where = { 'property.partner': { equals: user.id } }
    return ownScope
  }
  return false
}

const reindexParentProperty: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  if (context.skipHooks) return doc

  const propertyId = typeof doc.property === 'object' ? doc.property.id : doc.property
  if (!propertyId) return doc

  try {
    await indexPropertyById(req.payload, Number(propertyId))
  } catch (err) {
    req.payload.logger.error({
      msg: `Search index update failed for room-type ${doc.id}`,
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }

  return doc
}

const reindexParentPropertyAfterDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const propertyId = typeof doc.property === 'object' ? doc.property.id : doc.property
  if (!propertyId) return doc

  try {
    await indexPropertyById(req.payload, Number(propertyId))
  } catch (err) {
    req.payload.logger.error({
      msg: `Search index update failed after room-type ${doc.id} delete`,
      err: err instanceof Error ? err : new Error(String(err)),
    })
  }

  return doc
}

export const RoomTypes: CollectionConfig = {
  slug: 'room-types',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'property', 'basePrice', 'maxOccupancy', 'isActive'],
    group: 'Inventory',
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'partner',
    read: roomTypesRead,
    update: roomTypesUpdate,
    delete: adminsOnly,
  },
  hooks: {
    afterChange: [reindexParentProperty],
    afterDelete: [reindexParentPropertyAfterDelete],
  },
  fields: [
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      required: true,
      index: true,
      access: {
        update: adminFieldOnly,
      },
      filterOptions: ({ user }) => {
        if (!user?.id || user.role === 'admin') return true
        const ownScope = { partner: { equals: user.id } }
        return ownScope
      },
    },
    {
      name: 'name',
      label: 'Room Type Name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'basePrice',
      label: 'Base Price / Night',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Server-side pricing always reads from this field at booking time.',
      },
    },
    {
      name: 'compareAtPrice',
      label: 'Compare-at Price / Night',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Optional "was" price shown struck-through next to the current price. Must stay above base price to display.',
      },
      validate: (value: unknown, options: { data?: unknown }) => {
        if (value == null) return true
        const base = (options.data as { basePrice?: number } | undefined)?.basePrice
        if (typeof value === 'number' && base != null && value <= base) {
          return 'Compare-at price must be higher than the base price.'
        }
        return true
      },
    },
    {
      name: 'maxOccupancy',
      type: 'number',
      min: 1,
      defaultValue: 2,
    },
    {
      name: 'bedConfiguration',
      type: 'text',
      admin: { description: 'e.g. "1 King Bed" or "2 Twin Beds"' },
    },
    {
      name: 'sizeSqft',
      type: 'number',
      min: 0,
    },
    {
      name: 'amenities',
      type: 'relationship',
      relationTo: 'amenities',
      hasMany: true,
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
            purpose: { contains: 'room_photo' },
          },
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Inactive room types are hidden from booking.',
      },
    },
    {
      name: 'rooms',
      type: 'join',
      collection: 'rooms',
      on: 'roomType',
      maxDepth: 0,
      admin: {
        allowCreate: false,
        defaultColumns: ['roomNumber', 'floor', 'isActive'],
      },
    },
  ],
}

import type { Access, CollectionBeforeValidateHook, CollectionConfig, Where } from 'payload'
import { APIError } from 'payload'
import { adminsOnly, adminFieldOnly } from '../lib/access/predicates'

const roomsRead: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'partner') {
    const partnerScope: Where = {
      or: [
        { 'property.status': { equals: 'approved' } },
        { 'property.partner': { equals: user.id } },
      ],
    }
    return partnerScope
  }
  const publicScope: Where = { 'property.status': { equals: 'approved' } }
  return publicScope
}

const roomsUpdate: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'partner') {
    const ownScope: Where = { 'property.partner': { equals: user.id } }
    return ownScope
  }
  return false
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

const ensureUniqueRoomNumberPerProperty: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  const property = resolveId(data?.property)
  const roomNumber = data?.roomNumber

  if (operation !== 'create' || !property || !roomNumber) {
    if (operation === 'create' && !data?.property) {
      throw new APIError('Property is required.', 400)
    }
    return data
  }

  const conditions: Where[] = [
    { property: { equals: property } },
    { roomNumber: { equals: roomNumber } },
  ]

  if (originalDoc?.id) conditions.push({ id: { not_equals: originalDoc.id } })

  const { totalDocs } = await req.payload.count({
    collection: 'rooms',
    where: { and: conditions },
  })

  if (totalDocs > 0) {
    throw new APIError(`Room "${roomNumber}" already exists for this property.`, 400)
  }

  return data
}

export const Rooms: CollectionConfig = {
  slug: 'rooms',
  admin: {
    useAsTitle: 'roomNumber',
    defaultColumns: ['roomNumber', 'property', 'roomType', 'floor', 'isActive'],
    group: 'Inventory',
  },
  hooks: {
    beforeValidate: [ensureUniqueRoomNumberPerProperty],
  },
  access: {
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'partner',
    read: roomsRead,
    update: roomsUpdate,
    delete: adminsOnly,
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
      name: 'roomType',
      type: 'relationship',
      relationTo: 'room-types',
      required: true,
      index: true,
      access: {
        update: adminFieldOnly,
      },
      filterOptions: ({ user, siblingData }) => {
        if (!user?.id || user.role === 'admin') {
          const data = siblingData as { property?: string | number | { id?: string | number } } | undefined
          const property = resolveId(data?.property)
          if (property) {
            const scoped = { property: { equals: property } }
            return scoped
          }
          return true
        }
        const ownScope = { 'property.partner': { equals: user.id } }
        return ownScope
      },
    },
    {
      name: 'roomNumber',
      label: 'Room Number',
      type: 'text',
      required: true,
    },
    {
      name: 'floor',
      type: 'number',
      admin: { position: 'sidebar' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        position: 'sidebar',
        description: 'Inactive rooms cannot be booked.',
      },
    },
  ],
}

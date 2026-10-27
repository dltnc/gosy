import type { Access, CollectionConfig, Where } from 'payload'
import { adminsOnly } from '../lib/access/predicates'

const RESTRICTED_PURPOSES = ['payment_proof', 'invoice']

const mediaRead: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (!user) {
    const publicScope: Where = { purpose: { not_in: RESTRICTED_PURPOSES } }
    return publicScope
  }
  const ownerScope: Where = {
    or: [
      { purpose: { not_in: RESTRICTED_PURPOSES } },
      { uploadedBy: { equals: user.id } },
    ],
  }
  return ownerScope
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Assets',
    defaultColumns: ['filename', 'purpose', 'uploadedBy', 'updatedAt'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: mediaRead,
    update: ({ req: { user } }) => Boolean(user),
    delete: adminsOnly,
  },
  upload: {
    mimeTypes: ['image/*', 'application/pdf'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 768, height: 512, position: 'centre' },
      { name: 'hero', width: 1600 },
    ],
    adminThumbnail: 'thumbnail',
    focalPoint: true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
    {
      name: 'purpose',
      type: 'select',
      hasMany: true,
      defaultValue: ['property_photo'],
      options: [
        { label: 'Property Photo', value: 'property_photo' },
        { label: 'Room Photo', value: 'room_photo' },
        { label: 'Avatar', value: 'avatar' },
        { label: 'Locality Hero', value: 'locality_hero' },
        { label: 'Branding', value: 'branding' },
        { label: 'Payment Proof', value: 'payment_proof' },
        { label: 'Invoice', value: 'invoice' },
      ],
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      hooks: {
        beforeChange: [
          ({ req, operation, value }) => {
            if (operation === 'create' && !value) return req.user?.id
            return value
          },
        ],
      },
    },
  ],
}

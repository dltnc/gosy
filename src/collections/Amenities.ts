import type { CollectionConfig } from 'payload'
import { anyone, adminsOnly } from '../lib/access/predicates'

export const Amenities: CollectionConfig = {
  slug: 'amenities',
  admin: {
    useAsTitle: 'name',
    group: 'Inventory',
    defaultColumns: ['name', 'icon'],
  },
  access: {
    create: adminsOnly,
    read: anyone,
    update: adminsOnly,
    delete: adminsOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Icon identifier used by the frontend (e.g. lucide icon name).',
      },
    },
  ],
}

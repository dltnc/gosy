import type { CollectionConfig } from 'payload'
import { anyone, adminsOnly } from '../lib/access/predicates'

export const Localities: CollectionConfig = {
  slug: 'localities',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'isPopular'],
    group: 'Inventory',
    listSearchableFields: ['name', 'city'],
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
    },
    {
      name: 'city',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'location',
      type: 'point',
      label: 'Centroid Location',
      admin: {
        position: 'sidebar',
        description: '[longitude, latitude] — used for distance-sorted search.',
      },
    },
    {
      name: 'isPopular',
      label: 'Popular Locality',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Popular localities get their own landing page and homepage placement.',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      filterOptions: {
        purpose: { contains: 'locality_hero' },
      },
    },
    {
      name: 'properties',
      type: 'join',
      collection: 'properties',
      on: 'locality',
      maxDepth: 0,
      admin: {
        allowCreate: false,
        defaultColumns: ['name', 'status', 'tier', 'city'],
      },
    },
  ],
}

import type { CollectionConfig } from 'payload'
import { adminsOnly } from '../lib/access/predicates'

export const SubscriptionPlans: CollectionConfig = {
  slug: 'subscription-plans',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'price', 'durationDays', 'benefits.priorityScore', 'active'],
    group: 'Growth',
  },
  access: {
    create: adminsOnly,
    read: () => true,
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
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'durationDays',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 30,
    },
    {
      name: 'benefits',
      type: 'group',
      fields: [
        {
          name: 'priorityScore',
          type: 'number',
          required: true,
          min: 0,
          max: 100,
          defaultValue: 10,
          admin: {
            description:
              'Copied onto the property as featuredPriority on activation — drives search ranking.',
          },
        },
        {
          name: 'isFeatured',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'badgeText',
          type: 'text',
          admin: { description: 'Optional badge shown on the property card.' },
        },
      ],
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: { position: 'sidebar' },
    },
    {
      name: 'subscriptions',
      type: 'join',
      collection: 'property-subscriptions',
      on: 'plan',
      maxDepth: 0,
      admin: {
        allowCreate: false,
        defaultColumns: ['property', 'status', 'startDate', 'endDate'],
      },
    },
  ],
}

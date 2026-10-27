import type { Access, CollectionConfig, NumberFieldSingleValidation, Where } from 'payload'
import { adminsOnly, readOnlyField } from '../lib/access/predicates'
import { couponsApplyEndpoint } from '../endpoints/coupons-apply'

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  endpoints: [couponsApplyEndpoint],
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'active', 'discountType', 'discountValue', 'validUntil', 'currentUsageCount'],
    group: 'Growth',
    description:
      'Marketing promo codes. Validation runs server-side at booking time — see lib/coupons/validateCoupon.',
  },
  access: {
    create: adminsOnly,
    read: (({ req: { user } }) => {
      if (user?.role === 'admin') return true
      const now = new Date().toISOString()
      const publicScope: Where = {
        and: [
          { active: { equals: true } },
          {
            or: [
              { validFrom: { exists: false } },
              { validFrom: { less_than_equal: now } },
            ],
          },
          {
            or: [
              { validUntil: { exists: false } },
              { validUntil: { greater_than: now } },
            ],
          },
        ],
      }
      return publicScope
    }) as Access,
    update: adminsOnly,
    delete: adminsOnly,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
        ],
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Guest-facing summary shown on /offers.' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'validFrom',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'validUntil',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'discountType',
      type: 'select',
      required: true,
      defaultValue: 'percent',
      options: [
        { label: 'Percentage', value: 'percent' },
        { label: 'Fixed Amount', value: 'fixed' },
      ],
    },
    {
      name: 'discountValue',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Percent (0–100) when discountType is percent; absolute amount otherwise.',
      },
      validate: ((value: unknown, options: { siblingData?: { discountType?: string } }) => {
        if (value == null || Array.isArray(value)) return true
        const num = Number(value)
        if (Number.isNaN(num)) return 'Discount must be a number.'
        if (options?.siblingData?.discountType === 'percent') {
          return (num >= 0 && num <= 100) || 'Percentage discount must be between 0 and 100.'
        }
        return num >= 0 || 'Discount must be positive.'
      }) as NumberFieldSingleValidation,
    },
    {
      name: 'maxDiscountAmount',
      type: 'number',
      min: 0,
      admin: {
        position: 'sidebar',
        condition: (data) => data?.discountType === 'percent',
        description: 'Optional cap for percentage discounts.',
      },
    },
    {
      name: 'minBookingAmount',
      type: 'number',
      min: 0,
      admin: { position: 'sidebar' },
    },
    {
      name: 'usageLimitTotal',
      type: 'number',
      min: 0,
      admin: {
        position: 'sidebar',
        description: 'Total redemptions allowed across all guests. 0/blank = unlimited.',
      },
    },
    {
      name: 'usesPerUser',
      type: 'number',
      min: 0,
      defaultValue: 1,
      admin: {
        position: 'sidebar',
        description: 'Times one guest can use this coupon. 0/blank = unlimited.',
      },
    },
    {
      name: 'firstBookingOnly',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'scope',
      type: 'select',
      required: true,
      defaultValue: 'all_properties',
      options: [
        { label: 'All Properties', value: 'all_properties' },
        { label: 'Specific Properties', value: 'specific_properties' },
        { label: 'Property Tier', value: 'tier' },
        { label: 'City', value: 'city' },
      ],
    },
    {
      name: 'scopeProperties',
      type: 'relationship',
      relationTo: 'properties',
      hasMany: true,
      admin: { condition: (data) => data?.scope === 'specific_properties' },
    },
    {
      name: 'scopeTier',
      type: 'select',
      options: [
        { label: 'Budget', value: 'budget' },
        { label: 'Standard', value: 'standard' },
        { label: 'Premium', value: 'premium' },
        { label: 'Flagship', value: 'flagship' },
      ],
      admin: { condition: (data) => data?.scope === 'tier' },
    },
    {
      name: 'scopeCity',
      type: 'text',
      admin: { condition: (data) => data?.scope === 'city' },
    },
    {
      name: 'currentUsageCount',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Incremented automatically on first successful booking save.',
      },
      access: { update: readOnlyField },
    },
  ],
}

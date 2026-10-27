import type { GlobalConfig } from 'payload'
import { adminsOnly, anyone } from '../lib/access/predicates'

export const PlatformSettings: GlobalConfig = {
  slug: 'platform-settings',
  label: 'Platform Settings',
  admin: {
    group: 'Settings',
    description:
      'Non-secret platform configuration. This global is publicly readable — API credentials belong in Integrations & Credentials, never here.',
  },
  access: {
    read: anyone,
    update: adminsOnly,
    readVersions: adminsOnly,
  },
  fields: [
    {
      name: 'platformName',
      type: 'text',
      defaultValue: 'Hotel Booking Platform',
      admin: { description: 'Shown on invoices and transactional emails.' },
    },
    {
      name: 'branding',
      type: 'group',
      label: 'Branding',
      admin: {
        description:
          'Storefront logos. Anything left empty falls back to the site name rendered as text.',
      },
      fields: [
        {
          name: 'headerLogo',
          type: 'upload',
          relationTo: 'media',
          label: 'Header logo',
          filterOptions: { purpose: { contains: 'branding' } },
          admin: {
            description:
              'Shown in the site header, scaled to a 40px height. Wide transparent PNG or SVG works best. Tag the file with the “Branding” purpose to make it selectable.',
          },
        },
        {
          name: 'footerLogo',
          type: 'upload',
          relationTo: 'media',
          label: 'Footer logo',
          filterOptions: { purpose: { contains: 'branding' } },
          admin: {
            description:
              'Shown in the footer, which sits on a dark background — use a light or inverted asset. Falls back to the header logo, then to text.',
          },
        },
        {
          name: 'logoAlt',
          type: 'text',
          label: 'Logo alt text',
          admin: {
            description: 'Screen-reader text for the logo. Defaults to the platform name.',
          },
        },
      ],
    },
    {
      name: 'defaultCommissionRate',
      type: 'number',
      required: true,
      min: 0,
      max: 100,
      defaultValue: 10,
      admin: {
        description: 'Platform commission (%). Overridable per property by an admin.',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'BDT',
      admin: { position: 'sidebar' },
    },
    {
      name: 'loyaltyProgram',
      type: 'group',
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: true },
        {
          name: 'earnRatePer100Spent',
          type: 'number',
          min: 0,
          defaultValue: 1,
          admin: { description: 'Points earned per 100 currency units of booking total.' },
        },
        {
          name: 'redeemRate',
          type: 'number',
          min: 0,
          defaultValue: 0.5,
          admin: { description: 'Currency units each point is worth when redeemed.' },
        },
        {
          name: 'pointsExpireAfterDays',
          type: 'number',
          min: 1,
          defaultValue: 365,
        },
        {
          name: 'minRedeemPoints',
          type: 'number',
          min: 0,
          defaultValue: 100,
        },
        {
          name: 'maxRedeemPercentOfBooking',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 50,
          admin: { description: 'Max share (%) of the subtotal payable with points.' },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Payment Gateways (display toggles)',
      admin: { initCollapsed: false },
      fields: [
        {
          name: 'paymentGateways',
          type: 'group',
          fields: [
            {
              name: 'bkash',
              type: 'group',
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: false },
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'sandbox',
                  options: [
                    { label: 'Sandbox', value: 'sandbox' },
                    { label: 'Live', value: 'live' },
                  ],
                },
              ],
            },
            {
              name: 'nagad',
              type: 'group',
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: false },
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'sandbox',
                  options: [
                    { label: 'Sandbox', value: 'sandbox' },
                    { label: 'Live', value: 'live' },
                  ],
                },
              ],
            },
            {
              name: 'sslcommerz',
              type: 'group',
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: false },
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'sandbox',
                  options: [
                    { label: 'Sandbox', value: 'sandbox' },
                    { label: 'Live', value: 'live' },
                  ],
                },
              ],
            },
            {
              name: 'aamarpay',
              type: 'group',
              fields: [
                { name: 'enabled', type: 'checkbox', defaultValue: false },
                {
                  name: 'mode',
                  type: 'select',
                  defaultValue: 'sandbox',
                  options: [
                    { label: 'Sandbox', value: 'sandbox' },
                    { label: 'Live', value: 'live' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'bankTransferAccounts',
      type: 'array',
      labels: { singular: 'Bank Account', plural: 'Bank Transfer Accounts' },
      fields: [
        { name: 'bankName', type: 'text', required: true },
        { name: 'accountName', type: 'text', required: true },
        { name: 'accountNumber', type: 'text', required: true },
        { name: 'branchName', type: 'text' },
        { name: 'routingNumber', type: 'text' },
      ],
    },
    {
      name: 'bookingHoldGraceMinutes',
      type: 'number',
      min: 5,
      defaultValue: 30,
      admin: {
        position: 'sidebar',
        description: 'How long a pending_payment booking holds its room before the expiry job cancels it.',
      },
    },
  ],
}

import type { CollectionConfig } from 'payload'
import { render } from '@react-email/render'
import { adminsOnly, adminFieldOnly, readOnlyField } from '../lib/access/predicates'
import { usersSendOtpEndpoint } from '../endpoints/users-send-otp'
import { usersVerifyOtpEndpoint } from '../endpoints/users-verify-otp'
import { PasswordResetEmail } from '../lib/email/templates/PasswordResetEmail'

const RESET_TOKEN_EXPIRY_SECONDS = 60 * 60

export const Users: CollectionConfig = {
  slug: 'users',
  endpoints: [usersSendOtpEndpoint, usersVerifyOtpEndpoint],
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    maxLoginAttempts: 10,
    lockTime: 10 * 60 * 1000,
    forgotPassword: {
      expiration: RESET_TOKEN_EXPIRY_SECONDS * 1000,
      generateEmailSubject: () => 'Reset your StayBD password',
      // Payload's default link targets the admin panel. Guests reset from the
      // storefront instead, so point the token at the public /reset-password route.
      generateEmailHTML: async (args) => {
        const token = args?.token ?? ''
        const user = args?.user as { name?: string | null } | undefined
        const base = process.env.APP_URL || 'http://localhost:3000'

        return render(
          PasswordResetEmail({
            userName: user?.name ?? undefined,
            resetUrl: `${base}/reset-password?token=${encodeURIComponent(token)}`,
            expiryHours: RESET_TOKEN_EXPIRY_SECONDS / 3600,
          }),
        )
      },
    },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'phone', 'role', 'pointsBalance'],
    group: 'Identity',
  },
  access: {
    create: ({ req: { user } }) => !user || user.role === 'admin',
    read: ({ req: { user }, id }) => {
      if (user?.role === 'admin') return true
      if (!user) return false
      return user.id === id
    },
    update: ({ req: { user }, id }) => {
      if (user?.role === 'admin') return true
      if (!user) return false
      return user.id === id
    },
    delete: adminsOnly,
    admin: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'phone',
      type: 'text',
      index: true,
      validate: (value: unknown) => {
        if (!value) return true
        return (
          /^\+?[0-9]{10,15}$/.test(String(value)) || 'Please enter a valid phone number.'
        )
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'guest',
      options: [
        { label: 'Guest', value: 'guest' },
        { label: 'Partner', value: 'partner' },
        { label: 'Admin', value: 'admin' },
      ],
      saveToJWT: true,
      access: {
        update: adminFieldOnly,
        create: adminFieldOnly,
      },
    },
    {
      name: 'pointsBalance',
      label: 'Points Balance',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Cached sum of the loyalty-points ledger. Recomputed automatically.',
        position: 'sidebar',
      },
      access: {
        update: readOnlyField,
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
      filterOptions: {
        purpose: { contains: 'avatar' },
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Partner Profile',
          description: 'KYC and payout details. Visible to the account owner and admins only.',
          fields: [
            {
              name: 'partnerProfile',
              type: 'group',
              access: {
                read: ({ req: { user }, doc }) =>
                  user?.role === 'admin' || (Boolean(user) && doc?.id === user?.id),
                update: ({ req: { user }, doc }) =>
                  user?.role === 'admin' ||
                  ((user?.role === 'partner' || user?.id === doc?.id) && Boolean(doc)),
                create: ({ req: { user } }) => Boolean(user),
              },
              fields: [
                {
                  name: 'businessName',
                  type: 'text',
                },
                {
                  name: 'nidNumber',
                  label: 'NID Number',
                  type: 'text',
                },
                {
                  name: 'payoutMethod',
                  type: 'select',
                  options: [
                    { label: 'bKash', value: 'bkash' },
                    { label: 'Nagad', value: 'nagad' },
                    { label: 'Bank Transfer', value: 'bank' },
                  ],
                },
                {
                  name: 'payoutAccountNumber',
                  type: 'text',
                },
                {
                  name: 'bankDetails',
                  type: 'group',
                  fields: [
                    { name: 'bankName', type: 'text' },
                    { name: 'accountName', type: 'text' },
                    { name: 'accountNumber', type: 'text' },
                    { name: 'branchName', type: 'text' },
                    { name: 'routingNumber', type: 'text' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}

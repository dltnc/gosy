import type { Access, CollectionConfig, Where } from 'payload'
import { readOnlyField } from '../lib/access/predicates'

const emailLogsRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const ownScope: Where = {
    or: [
      { 'relatedBooking.guest': { equals: user.id } },
      { to: { equals: user.email } },
    ],
  }
  return ownScope
}

export const EmailLogs: CollectionConfig = {
  slug: 'email-logs',
  admin: {
    useAsTitle: 'subject',
    defaultColumns: ['to', 'template', 'status', 'lastEventAt', 'createdAt'],
    group: 'Notifications',
    description:
      'Written when transactional emails send. Updated by Resend webhook events (lib/email webhook handler).',
  },
  access: {
    create: () => false,
    read: emailLogsRead,
    update: readOnlyField,
    delete: () => false,
  },
  fields: [
    {
      name: 'to',
      type: 'email',
      required: true,
      index: true,
    },
    {
      name: 'subject',
      type: 'text',
      required: true,
    },
    {
      name: 'template',
      type: 'text',
      admin: { description: 'e.g. BookingConfirmationEmail' },
    },
    {
      name: 'resendEmailId',
      type: 'text',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'sent',
      options: [
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Bounced', value: 'bounced' },
        { label: 'Complained', value: 'complained' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'lastEventAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'error',
      type: 'textarea',
    },
    {
      name: 'relatedBooking',
      type: 'relationship',
      relationTo: 'bookings',
      maxDepth: 0,
    },
  ],
}

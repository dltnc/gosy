import type { Access, CollectionConfig, Where } from 'payload'
import { readOnlyField } from '../lib/access/predicates'

const smsLogsRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  const ownScope: Where = {
    or: [
      { 'relatedBooking.guest': { equals: user.id } },
      { phone: { equals: user.phone ?? '__unmatched__' } },
    ],
  }
  return ownScope
}

export const SmsLogs: CollectionConfig = {
  slug: 'sms-logs',
  admin: {
    useAsTitle: 'phone',
    defaultColumns: ['phone', 'purpose', 'deliveryStatus', 'errorCode', 'createdAt'],
    group: 'Notifications',
    description:
      'Written by the SMS adapter (lib/sms) — never edited after creation. Delivery status is updated by the polling job.',
  },
  access: {
    create: () => false,
    read: smsLogsRead,
    update: readOnlyField,
    delete: () => false,
  },
  fields: [
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
    },
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: [
        { label: 'OTP Verification', value: 'otp_verification' },
        { label: 'Booking Confirmation', value: 'booking_confirmation' },
        { label: 'Booking Cancellation', value: 'booking_cancellation' },
        { label: 'Payment Status', value: 'payment_status' },
        { label: 'Partner Notification', value: 'partner_notification' },
        { label: 'Balance Alert', value: 'balance_alert' },
      ],
    },
    {
      name: 'gatewayRequestId',
      type: 'text',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'deliveryStatus',
      type: 'select',
      defaultValue: 'queued',
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Pending', value: 'pending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Failed', value: 'failed' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    {
      name: 'errorCode',
      type: 'number',
      admin: { position: 'sidebar' },
    },
    {
      name: 'errorMessage',
      type: 'text',
    },
    {
      name: 'sentAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
    {
      name: 'relatedBooking',
      type: 'relationship',
      relationTo: 'bookings',
      maxDepth: 0,
    },
  ],
}

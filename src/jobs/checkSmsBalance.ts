import type { TaskConfig } from 'payload'
import { getSmsBalance, sendSms } from '../lib/sms/smsBd.adapter'
import { sendAdminAlertEmail } from '../lib/email/send'
import { resolveSmsConfig } from '../lib/settings/integrations'

export const checkSmsBalance: TaskConfig<'checkSmsBalance'> = {
  slug: 'checkSmsBalance',
  label: 'Check SMS Balance',
  inputSchema: [],
  outputSchema: [
    { name: 'balance', type: 'number' },
    { name: 'alerted', type: 'checkbox' },
  ],
  schedule: [{ cron: '0 0 9 * * *', queue: 'default' }],
  retries: 2,
  handler: async ({ req }) => {
    // Credentials and the alert threshold are both admin-editable, so they are resolved per run
    // rather than read once at module load.
    const smsConfig = await resolveSmsConfig(req.payload)
    if (!smsConfig) {
      return { output: { balance: 0, alerted: false } }
    }

    const balance = await getSmsBalance(req.payload)

    if (balance == null) {
      return { output: { balance: 0, alerted: false } }
    }

    let alerted = false
    if (balance < smsConfig.balanceThreshold) {
      const message = `SMS gateway balance is low (${balance}). Top up before OTPs and booking notifications fail.`

      await sendAdminAlertEmail(req.payload, {
        alertTitle: 'SMS balance low',
        message,
        details: 'sms.bd fails sends silently with Error 417 once the balance runs out.',
      })

      const { docs } = await req.payload.find({
        collection: 'users',
        where: { role: { equals: 'admin' } },
        limit: 1,
        depth: 0,
        select: { phone: true },
      })

      const adminPhone = docs[0]?.phone
      if (adminPhone) {
        await sendSms({
          payload: req.payload,
          to: adminPhone,
          message: `ALERT: ${message}`,
          purpose: 'partner_notification',
          req,
        })
      }

      alerted = true
    }

    return { output: { balance, alerted } }
  },
}

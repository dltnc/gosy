import type { Metadata } from 'next'
import { ContentPage, H2 } from '@/components/layout/content-page'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How StayBD collects, uses and protects your data.',
}

export default function PrivacyPage() {
  return (
    <ContentPage title="Privacy Policy" updated="August 2026">
      <p>
        This placeholder policy must be reviewed for compliance with applicable Bangladeshi law
        (and any international regimes that apply to you) before production use.
      </p>
      <H2>What we collect</H2>
      <p>
        Account details (name, email, phone), booking and payment records, property reviews you
        publish, and technical logs (IP address, device) needed to run the service securely.
        Partner accounts additionally include KYC/payout information, which is visible only to
        platform administrators.
      </p>
      <H2>How we use it</H2>
      <p>
        To operate bookings, send transactional SMS/email confirmations, prevent fraud, calculate
        partner payouts, and provide support. We never sell personal data. Marketing emails are
        opt-in only.
      </p>
      <H2>Payment data</H2>
      <p>
        Card and mobile-wallet details are processed directly by our licensed payment gateways
        (bKash, Nagad, SSLCommerz, AmarPay). StayBD stores only gateway transaction references —
        never full card numbers or wallet credentials.
      </p>
      <H2>Your choices</H2>
      <p>
        You can access and update your profile from the dashboard, request account deletion by
        contacting support, and ask for a copy of your booking history at any time.
      </p>
    </ContentPage>
  )
}

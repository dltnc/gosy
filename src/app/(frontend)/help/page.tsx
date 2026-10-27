import type { Metadata } from 'next'
import { ContentPage, H2 } from '@/components/layout/content-page'

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Answers to common questions about booking with StayBD.',
}

export default function HelpPage() {
  return (
    <ContentPage title="Help Center">
      <H2>Booking & payment</H2>
      <p>
        <strong>Which payment methods can I use?</strong> bKash, Nagad, SSLCommerz (cards and
        net banking), AmarPay, and direct bank transfer. Bank transfers are verified manually —
        your room is held while we confirm.
      </p>
      <p>
        <strong>Why did my room get released?</strong> Unpaid bookings hold the room for 30
        minutes. If a gateway redirect fails or is abandoned, the hold expires automatically.
      </p>
      <H2>Loyalty points</H2>
      <p>
        Points post after you check out, not when you pay — so cancelled trips never earn. Redeem
        them at checkout for up to 50% of a stay&apos;s value; see the Points page in your
        dashboard for your balance and history.
      </p>
      <H2>Coupons</H2>
      <p>
        Codes are validated live at checkout. Some are limited to specific properties, cities, or
        first-time bookers — the checkout page will tell you if a code doesn&apos;t apply.
      </p>
      <H2>Still stuck?</H2>
      <p>
        Contact support with your booking reference and we&apos;ll sort it out — see the Contact
        page for channels and hours.
      </p>
    </ContentPage>
  )
}

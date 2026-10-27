import type { Metadata } from 'next'
import { ContentPage, H2 } from '@/components/layout/content-page'

export const metadata: Metadata = {
  title: 'Cancellation Policy',
  description: 'How cancellations and refunds work on StayBD.',
}

export default function CancellationPolicyPage() {
  return (
    <ContentPage title="Cancellation Policy" updated="August 2026">
      <p>
        Every property shows its own cancellation policy on its page. The categories below are the
        platform defaults — a property&apos;s stated policy always takes precedence where it is
        stricter or more generous.
      </p>
      <H2>Before payment</H2>
      <p>
        Unpaid bookings (pending payment) are held for 30 minutes and then released automatically
        — you are never charged for an abandoned checkout.
      </p>
      <H2>Free cancellation window</H2>
      <p>
        Unless the property states otherwise, cancelling at least 48 hours before check-in
        qualifies for a full refund. Cancelling inside 48 hours forfeits the first night; no-shows
        are non-refundable.
      </p>
      <H2>Partner cancellations</H2>
      <p>
        If a partner cancels your confirmed booking, you receive a full refund plus loyalty points
        as compensation, and we will help you find comparable accommodation.
      </p>
      <H2>Refund timelines</H2>
      <p>
        Approved refunds are issued to the original payment method: typically 3–7 business days
        for mobile wallets and 5–10 business days for cards, depending on the gateway.
      </p>
    </ContentPage>
  )
}

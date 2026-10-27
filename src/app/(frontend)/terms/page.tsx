import type { Metadata } from 'next'
import { ContentPage, H2 } from '@/components/layout/content-page'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms governing your use of StayBD.',
}

export default function TermsPage() {
  return (
    <ContentPage title="Terms of Service" updated="August 2026">
      <p>
        These placeholder terms must be reviewed by a qualified lawyer before production use.
        They outline the intended structure only.
      </p>
      <H2>1. The service</H2>
      <p>
        StayBD operates a marketplace connecting guests with independent property partners. We are
        not the owner or operator of listed properties; each partner is solely responsible for
        their listing content, room quality, and honouring confirmed reservations.
      </p>
      <H2>2. Bookings and payment</H2>
      <p>
        A booking becomes binding once payment succeeds (or, for bank transfer, once we verify
        your transfer). Prices are set by partners in BDT and shown inclusive of platform
        commission. Discount codes and loyalty points may be applied at checkout subject to their
        own terms.
      </p>
      <H2>3. Cancellations</H2>
      <p>
        Guests may cancel pending or confirmed bookings; refunds follow the cancellation policy
        displayed on each property page and our Cancellation Policy page.
      </p>
      <H2>4. Accounts</H2>
      <p>
        You agree to provide accurate information, keep your credentials secure, and use phone
        verification when asked. One person may hold one guest account unless we approve more.
      </p>
      <H2>5. Liability</H2>
      <p>
        To the maximum extent permitted by law, StayBD&apos;s aggregate liability for any claim
        relating to a booking is limited to the total amount paid for that booking.
      </p>
    </ContentPage>
  )
}

import type { Metadata } from 'next'
import { ContentPage, H2 } from '@/components/layout/content-page'

export const metadata: Metadata = {
  title: 'About',
  description: 'What StayBD is and how it works.',
}

export default function AboutPage() {
  return (
    <ContentPage title="About StayBD">
      <p>
        StayBD is a Bangladesh-first hotel and resort booking platform. We connect travellers with
        verified properties — from budget stays in Dhaka to beach resorts in Cox&apos;s Bazar —
        with local payment methods (bKash, Nagad, SSLCommerz, AmarPay) and instant confirmation.
      </p>
      <H2>How booking works</H2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Search by city or locality and pick your dates.</li>
        <li>
          Choose a room — availability is checked against real bookings the moment you pay.
        </li>
        <li>Pay with your preferred gateway or bank transfer.</li>
        <li>Get an SMS and email confirmation instantly, plus points for future stays.</li>
      </ol>
      <H2>For property partners</H2>
      <p>
        Partners list their properties free of charge. We take a transparent commission on
        completed stays only — no listing fees, no hidden charges. Featured placement is optional
        and clearly labelled. Apply for a partner account to get started.
      </p>
    </ContentPage>
  )
}

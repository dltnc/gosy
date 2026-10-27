import type { Metadata } from 'next'
import { ContentPage, H2 } from '@/components/layout/content-page'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with the StayBD team.',
}

export default function ContactPage() {
  return (
    <ContentPage title="Contact us">
      <p>
        Need help with a booking, a listing, or anything else? We usually reply within one
        business day.
      </p>
      <H2>Guest support</H2>
      <p>
        Email: support@staybd.example · Phone: +880 1XXX-XXXXXX (9am–9pm, every day). Include your
        booking reference (starts with BK-) for the fastest response.
      </p>
      <H2>Partners</H2>
      <p>
        Interested in listing your property or have questions about payouts? Email
        partners@staybd.example.
      </p>
      <H2>Registered office</H2>
      <p>
        StayBD Ltd., [Street Address], Dhaka, Bangladesh. (Replace these placeholders with real
        contact details before launch.)
      </p>
    </ContentPage>
  )
}

import React from 'react'
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Work_Sans } from 'next/font/google'
import './styles.css'

import { AnalyticsScripts } from '@/components/layout/analytics-scripts'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { Providers } from '@/components/providers'
import { getFooterPageLinks } from '@/lib/pages/footerLinks'
import { getAnalyticsInjection } from '@/lib/settings/analytics'
import { getBranding } from '@/lib/settings/branding'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  description: 'Find and book hotels and resorts across Bangladesh.',
  title: {
    default: 'StayBD — Hotels & Resorts in Bangladesh',
    template: '%s · StayBD',
  },
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props
  // Fetched once here rather than in each component: the header is a client component and cannot
  // query Payload itself, and this keeps header and footer from issuing two separate reads.
  const branding = await getBranding()
  // Admin-configured tags. This layout covers the storefront only, so nothing reaches the admin panel.
  const analytics = await getAnalyticsInjection()
  // CMS pages that asked to be linked from the footer.
  const footerPageLinks = await getFooterPageLinks()

  return (
    <html lang="en" className={`${jakarta.variable} ${workSans.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <AnalyticsScripts injection={analytics} />
        <Providers>
          <SiteHeader branding={branding} />
          <main className="flex-1">{children}</main>
          <SiteFooter branding={branding} pageLinks={footerPageLinks} />
        </Providers>
      </body>
    </html>
  )
}

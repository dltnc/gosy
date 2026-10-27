import Link from 'next/link'
import { Globe, Mail, Share2 } from 'lucide-react'

import { SiteLogo } from '@/components/layout/site-logo'
import type { FooterPageLink } from '@/lib/pages/footerLinks'
import type { Branding } from '@/lib/settings/branding'

const FOOTER_COLUMNS = [
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Become a Partner', href: '/partner' },
      { label: 'Offers', href: '/offers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Cancellation Policy', href: '/cancellation-policy' },
      { label: 'My Bookings', href: '/dashboard/bookings' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Sitemap', href: '/sitemap.xml' },
    ],
  },
]

const SOCIALS = [
  { label: 'Website', href: '/about', Icon: Globe },
  { label: 'Share', href: '/about', Icon: Share2 },
  { label: 'Email us', href: '/contact', Icon: Mail },
]

/**
 * `pageLinks` are CMS pages that asked to appear here, added as a fourth column. Both grid classes are
 * written out in full because Tailwind reads them from the source, not from a computed string.
 */
export function SiteFooter({
  branding,
  pageLinks = [],
}: {
  branding: Branding
  pageLinks?: FooterPageLink[]
}) {
  const columns = pageLinks.length
    ? [...FOOTER_COLUMNS, { title: 'More', links: pageLinks }]
    : FOOTER_COLUMNS
  const columnGrid = pageLinks.length
    ? 'grid grid-cols-2 gap-12 sm:grid-cols-4 md:w-2/3'
    : 'grid grid-cols-2 gap-12 sm:grid-cols-3 md:w-2/3'

  return (
    <footer className="border-t border-white/10 bg-primary py-stack-lg text-primary-foreground">
      <div className="mx-auto max-w-site px-gutter">
        <div className="mb-12 flex flex-col items-start justify-between gap-stack-lg md:flex-row">
          <div className="md:w-1/3">
            <Link
              href="/"
              className="mb-6 flex items-center text-xl font-bold text-primary-foreground"
            >
              {branding.footer ? (
                <SiteLogo logo={branding.footer} alt={branding.alt} height={36} />
              ) : (
                branding.siteName
              )}
            </Link>
            <p className="mb-8 max-w-xs text-body-md text-primary-fixed-dim">
              Redefining travel across Bangladesh through clarity, value, and unwavering reliability
              — from Cox&apos;s Bazar to the hill tracts.
            </p>
            <div className="flex gap-4">
              {SOCIALS.map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex size-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-secondary"
                >
                  <Icon className="size-4" />
                </Link>
              ))}
            </div>
          </div>
          <div className={columnGrid}>
            {columns.map((column) => (
              <div key={column.title}>
                <h5 className="mb-6 font-bold text-white">{column.title}</h5>
                <ul className="space-y-4">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-body-md text-primary-fixed-dim transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 md:flex-row">
          <p className="text-body-md text-primary-fixed-dim">
            © {new Date().getFullYear()} {branding.siteName}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-body-md text-primary-fixed-dim">
              <Globe className="size-4" /> English
            </span>
            <span className="flex items-center gap-2 text-body-md text-primary-fixed-dim">
              ৳ BDT
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

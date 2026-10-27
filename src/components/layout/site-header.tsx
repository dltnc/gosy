'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CircleHelp, Globe, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { SiteLogo } from '@/components/layout/site-logo'
import type { Branding } from '@/lib/settings/branding'
import { cn } from '@/lib/utils'

type SessionUser = { id: number | string; name?: string; email?: string; role?: string }

const NAV_LINKS = [
  { label: 'Hotels', href: '/' },
  { label: 'Deals', href: '/offers' },
  { label: 'Support', href: '/help' },
]

export function SiteHeader({ branding }: { branding: Branding }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isPartner = user?.role === 'partner' || user?.role === 'admin'
  /**
   * Three states, not two. A visitor gets a login CTA and a partner gets a way back into their
   * workspace, but a signed-in guest gets nothing: `/partner` would bounce them straight back out
   * (there is no partner sign-up route to send them to), and a link that only ever rejects you is
   * worse than no link. Withheld until the session resolves so the CTA does not flash at a guest.
   */
  const partnerLink = isPartner
    ? { href: '/partner', label: 'Partner workspace' }
    : sessionLoaded && !user
      ? { href: '/partner', label: 'Partner Login' }
      : null

  useEffect(() => {
    let active = true
    fetch('/api/users/me', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: SessionUser | null } | null) => {
        if (active) {
          setUser(data?.user ?? null)
          setSessionLoaded(true)
        }
      })
      .catch(() => {
        if (active) setSessionLoaded(true)
      })
    return () => {
      active = false
    }
  }, [pathname])

  async function signOut() {
    await fetch('/api/users/logout', {
      method: 'POST',
      credentials: 'same-origin',
    }).catch(() => {})
    setUser(null)
    setMenuOpen(false)
    router.refresh()
    router.push('/')
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  return (
    <header className="sticky top-0 z-50 h-20 border-b bg-background shadow-sm">
      <div className="mx-auto flex h-20 w-full max-w-site items-center justify-between px-gutter">
        <div className="flex items-center gap-10">
          <Link
            href="/"
            className="flex items-center text-headline-md font-bold text-secondary"
            aria-label={`${branding.siteName} home`}
          >
            {branding.header ? (
              <SiteLogo logo={branding.header} alt={branding.alt} height={40} />
            ) : (
              branding.siteName
            )}
          </Link>
          <nav className="hidden h-full items-center gap-8 md:flex" aria-label="Main">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={cn(
                  'border-b-2 pb-1 font-semibold transition-colors',
                  isActive(link.href)
                    ? 'border-secondary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-primary',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-1 border-r border-border pr-4 lg:flex">
            <button
              type="button"
              aria-label="Change language"
              className="rounded p-2 text-muted-foreground transition-colors hover:bg-surface-container-low hover:text-foreground"
            >
              <Globe className="size-5" />
            </button>
            <Link
              href="/help"
              aria-label="Help center"
              className="rounded p-2 text-muted-foreground transition-colors hover:bg-surface-container-low hover:text-foreground"
            >
              <CircleHelp className="size-5" />
            </Link>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {partnerLink ? (
              <Button
                asChild
                variant="ghost"
                className="text-primary hover:bg-surface-container-low hover:text-primary"
              >
                <Link href={partnerLink.href}>{partnerLink.label}</Link>
              </Button>
            ) : null}
            {user ? (
              <>
                <Button asChild variant="outline">
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" />
                    My account
                  </Link>
                </Button>
                <Button variant="ghost" size="icon" aria-label="Sign out" onClick={signOut}>
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <Button asChild variant="cta">
                <Link href="/signup">Sign Up</Link>
              </Button>
            )}
          </div>

          <button
            type="button"
            className="rounded p-2 text-foreground md:hidden"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="border-b bg-background px-gutter pb-6 shadow-lift md:hidden">
          <nav className="flex flex-col gap-1 pt-2" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  'rounded-md px-3 py-3 font-semibold transition-colors',
                  isActive(link.href)
                    ? 'bg-surface-container-low text-primary'
                    : 'text-muted-foreground hover:bg-surface-container-low hover:text-foreground',
                )}
              >
                {link.label}
              </Link>
            ))}
            {partnerLink ? (
              <Link
                href={partnerLink.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 font-semibold text-muted-foreground transition-colors hover:bg-surface-container-low hover:text-foreground"
              >
                {partnerLink.label}
              </Link>
            ) : null}
            {user ? (
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-3 font-semibold text-primary transition-colors hover:bg-surface-container-low"
              >
                My account
              </Link>
            ) : (
              <Button asChild variant="cta" size="lg" className="mt-2 w-full">
                <Link href="/signup" onClick={() => setMenuOpen(false)}>
                  Sign Up
                </Link>
              </Button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  )
}

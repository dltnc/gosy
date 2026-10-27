'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BedDouble,
  CalendarCheck,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Plus,
  Sparkles,
  Wallet,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/partner', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/partner/properties', label: 'Properties', icon: BedDouble },
  { href: '/partner/bookings', label: 'Bookings', icon: CalendarCheck },
  { href: '/partner/payouts', label: 'Payouts', icon: Wallet },
  { href: '/partner/subscriptions', label: 'Subscriptions', icon: Sparkles },
]

export function PartnerSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
    router.push('/')
    router.refresh()
  }

  return (
    <aside className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto bg-surface-container p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:border-r lg:border-outline">
      <div className="hidden lg:mb-6 lg:block">
        <Link href="/" className="text-xl font-black text-primary">
          StayBD
        </Link>
        <p className="text-xs text-muted-foreground">Partner Workspace</p>
      </div>

      <nav className="flex gap-1 lg:mb-6 lg:flex lg:flex-col lg:gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/partner' ? pathname === '/partner' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-lg p-3 text-sm font-semibold transition-all active:scale-[0.98]',
                active
                  ? 'bg-primary-container text-white'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Button asChild variant="cta" className="hidden w-full lg:mb-auto lg:flex">
        <Link href="/partner/properties/new">
          <Plus className="size-4" aria-hidden />
          New Property
        </Link>
      </Button>

      <div className="hidden flex-col gap-1 border-t border-outline pt-4 lg:mt-4 lg:flex">
        <Link
          href="/help"
          className="flex items-center gap-3 rounded-lg p-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LifeBuoy className="size-4" aria-hidden />
          Help Center
        </Link>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 rounded-lg p-3 text-left text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
          Logout
        </button>
      </div>

      <button
        type="button"
        onClick={logout}
        className="flex shrink-0 items-center gap-2 rounded-lg p-3 text-sm font-semibold text-muted-foreground lg:hidden"
      >
        <LogOut className="size-4" aria-hidden />
        Logout
      </button>
    </aside>
  )
}

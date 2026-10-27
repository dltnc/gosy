'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  BookOpenText,
  Coins,
  Compass,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Star,
  TicketPercent,
  UserRound,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/bookings', label: 'My Bookings', icon: BookOpenText },
  { href: '/dashboard/wishlist', label: 'Wishlist', icon: Heart },
  { href: '/dashboard/points', label: 'Loyalty Points', icon: Coins },
  { href: '/dashboard/offers', label: 'My Offers', icon: TicketPercent },
  { href: '/dashboard/reviews', label: 'Reviews', icon: Star },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
  { href: '/dashboard/profile', label: 'Settings', icon: UserRound },
]

export function DashboardSidebar() {
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
      </div>

      <nav className="flex gap-1 lg:mb-6 lg:flex lg:flex-col lg:gap-1">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href)
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
        <Link href="/">
          <Compass className="size-4" aria-hidden />
          Book New Trip
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

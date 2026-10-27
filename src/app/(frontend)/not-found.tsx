import type { Metadata } from 'next'
import Link from 'next/link'
import { Compass, LifeBuoy, TicketPercent } from 'lucide-react'

import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Page not found',
}

const SUGGESTIONS = [
  {
    href: '/hotels-in/Dhaka',
    label: 'Hotels in Dhaka',
    description: 'City stays, from budget to flagship.',
    icon: Compass,
  },
  {
    href: '/offers',
    label: 'Current offers',
    description: 'Coupon codes you can use at checkout.',
    icon: TicketPercent,
  },
  {
    href: '/help',
    label: 'Help Center',
    description: 'Booking, payment and cancellation answers.',
    icon: LifeBuoy,
  },
]

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
      <p className="text-sm font-bold tracking-widest text-muted-foreground">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The link may be out of date, or the stay you were looking at is no longer listed. Everything
        else is still where you left it.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild variant="cta" size="lg">
          <Link href="/">Back to search</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>

      <div className="mt-12 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
        {SUGGESTIONS.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent"
            >
              <Icon className="size-5 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-semibold">{item.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

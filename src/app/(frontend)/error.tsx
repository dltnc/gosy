'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function FrontendError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-thrown errors reach the client already scrubbed, so the digest is
    // the only handle for matching this screen to a server log line.
    console.error('Frontend route error', error)
  }, [error])

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
      <TriangleAlert className="size-10 text-destructive" aria-hidden />
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        This page failed to load. Nothing you were doing was lost — your bookings and payments are
        unaffected. Trying again usually clears it.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" variant="cta" size="lg" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden />
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Back to search</Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-8 text-xs text-muted-foreground">
          If you contact support, quote reference{' '}
          <span className="font-mono text-foreground">{error.digest}</span>.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">
        Still stuck?{' '}
        <Link href="/contact" className="font-semibold text-foreground hover:underline">
          Get in touch
        </Link>
        .
      </p>
    </div>
  )
}

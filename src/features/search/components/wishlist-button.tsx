'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Heart, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

interface WishlistButtonProps {
  propertyId: number
  propertyName: string
  initial?: boolean
  onToggled?: (wishlisted: boolean) => void
  className?: string
}

export function WishlistButton({
  propertyId,
  propertyName,
  initial = false,
  onToggled,
  className,
}: WishlistButtonProps) {
  const router = useRouter()
  const [wishlisted, setWishlisted] = useState(initial)
  const [pending, setPending] = useState(false)

  async function toggle(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (pending) return
    setPending(true)

    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ propertyId }),
      })

      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`)
        return
      }
      if (!res.ok) throw new Error('Could not update wishlist.')
      const data = (await res.json()) as { wishlisted: boolean }
      setWishlisted(data.wishlisted)
      onToggled?.(data.wishlisted)
    } catch {
      // keep previous state on failure
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={wishlisted}
      aria-label={wishlisted ? `Remove ${propertyName} from wishlist` : `Save ${propertyName} to wishlist`}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60',
        wishlisted && 'text-secondary',
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Heart className={cn('size-4', wishlisted && 'fill-secondary')} aria-hidden />
      )}
    </button>
  )
}

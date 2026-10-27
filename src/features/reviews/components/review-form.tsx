'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SUB_RATINGS = [
  { field: 'cleanlinessRating', label: 'Cleanliness' },
  { field: 'locationRating', label: 'Location' },
  { field: 'serviceRating', label: 'Service' },
] as const

interface ReviewFormProps {
  bookingId: number
}

export function ReviewForm({ bookingId }: ReviewFormProps) {
  const router = useRouter()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [subRatings, setSubRatings] = useState<Record<string, number>>({})
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (rating === 0) {
      setError('Please pick a rating.')
      return
    }
    setError(null)
    setState('submitting')

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          booking: bookingId,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim() || undefined,
          ...Object.fromEntries(
            Object.entries(subRatings).filter(([, value]) => value > 0),
          ),
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { errors?: { message?: string }[] } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not submit your review.')
      }

      setState('done')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your review.')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Thanks — your review is live.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rate your stay</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div
            className="flex gap-1"
            role="radiogroup"
            aria-label="Overall rating"
            onMouseLeave={() => setHovered(0)}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                onMouseEnter={() => setHovered(value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
                className="rounded p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={`size-7 ${
                    (hovered || rating) >= value
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SUB_RATINGS.map((sub) => (
              <div key={sub.field} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{sub.label}</Label>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setSubRatings((prev) => ({
                          ...prev,
                          [sub.field]: prev[sub.field] === value ? 0 : value,
                        }))
                      }
                      aria-label={`${sub.label} ${value}`}
                      className="p-0.5"
                    >
                      <Star
                        className={`size-4 ${
                          (subRatings[sub.field] ?? 0) >= value
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground/50'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-title">Title (optional)</Label>
            <Input
              id="review-title"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Sum up your stay in a line"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-comment">Your review (optional)</Label>
            <textarea
              id="review-comment"
              maxLength={2000}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What stood out — good or bad?"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>

          {error ? (
            <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
          ) : null}

          <Button type="submit" disabled={state === 'submitting'}>
            {state === 'submitting' ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : (
              'Publish review'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

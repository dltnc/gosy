import { Star } from 'lucide-react'

interface Review {
  id: number
  rating: number
  title?: string | null
  comment?: string | null
  partnerReply?: string | null
  createdAt: string
  guest?: { name?: string | null } | number | null
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className={`size-4 ${
            v <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/50'
          }`}
        />
      ))}
    </span>
  )
}

export function ReviewsList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No written reviews yet — be the first after your stay.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      {reviews.map((review) => {
        const guestName =
          typeof review.guest === 'object' && review.guest !== null
            ? (review.guest.name ?? 'Guest')
            : 'Guest'

        return (
          <article key={review.id} className="space-y-1.5 border-b pb-5 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <Stars value={review.rating} />
              <time className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            </div>
            {review.title ? <p className="font-medium">{review.title}</p> : null}
            {review.comment ? (
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            ) : null}
            <p className="text-xs font-medium">{guestName}</p>

            {review.partnerReply ? (
              <div className="mt-2 rounded-lg bg-muted p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Response from the property
                </p>
                <p className="mt-1 text-sm">{review.partnerReply}</p>
              </div>
            ) : null}
          </article>
        )
      })}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { headers as getHeaders } from 'next/headers'

import { ReviewsList } from '@/features/reviews/components/reviews-list'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'

export const metadata: Metadata = {
  title: 'My reviews',
}

export default async function MyReviewsPage() {
  const payload = await getPayloadClient()
  const headers = await getHeaders()
  const { user } = await payload.auth({ headers })

  const { docs: reviews } = await payload.find({
    collection: 'reviews',
    where: { guest: { equals: user!.id } },
    sort: '-createdAt',
    limit: 50,
    depth: 1,
    overrideAccess: false,
    user,
  })

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">My reviews</h1>
        <p className="text-sm text-muted-foreground">
          Reviews you&apos;ve written after completed stays.
        </p>
      </header>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No reviews yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            After you check out, a review form appears on the booking page.
          </p>
          <Link
            href="/dashboard/bookings?tab=past"
            className="mt-3 inline-block text-sm underline underline-offset-4"
          >
            See past stays
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-6">
          <ReviewsList
            reviews={reviews.map((review) => ({
              ...review,
              guest: typeof review.guest === 'object' ? review.guest : null,
            }))}
          />
        </div>
      )}
    </div>
  )
}

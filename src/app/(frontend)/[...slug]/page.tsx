import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import type { Page } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload/getPayloadClient'
import { PageBlocks } from '@/features/pages/components/page-blocks'

/**
 * Editor-built pages, one route for all of them.
 *
 * A catch-all so a slug can carry `/` and group pages under a folder. Next resolves static segments
 * before this one, so every real route — `/offers`, `/property/[slug]`, `/api/*` — still wins; the
 * collection refuses those slugs at save time anyway. Being the last route also means this file
 * answers every unmatched URL, which is why a miss calls `notFound()` and renders the app's 404.
 *
 * Timed revalidation rather than on-demand: a page that embeds a property grid should pick up price
 * and availability changes on its own, not only when an admin re-saves it.
 */

export const revalidate = 60

interface PageRouteProps {
  params: Promise<{ slug: string[] }>
}

async function getPage(path: string): Promise<Page | null> {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'pages',
    where: { and: [{ slug: { equals: path } }, { _status: { equals: 'published' } }] },
    // Deep enough for uploads inside blocks and for a picked property's own hero image and locality,
    // which `buildSearchDocument` reads when the property grid renders.
    depth: 2,
    limit: 1,
    draft: false,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

export async function generateMetadata({ params }: PageRouteProps): Promise<Metadata> {
  const { slug } = await params
  const path = slug.join('/')
  const page = await getPage(path).catch(() => null)
  if (!page) return { title: 'Page not found' }

  const shareImage =
    typeof page.seo?.image === 'object' && page.seo.image !== null ? page.seo.image.url : null

  return {
    title: page.title,
    description: page.seo?.description ?? undefined,
    alternates: { canonical: `/${path}` },
    ...(page.seo?.noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: page.title,
      description: page.seo?.description ?? undefined,
      ...(shareImage ? { images: [{ url: shareImage }] } : {}),
    },
  }
}

export default async function CmsPage({ params }: PageRouteProps) {
  const { slug } = await params
  const page = await getPage(slug.join('/'))

  if (!page) notFound()

  return (
    <div className="flex flex-col pb-16">
      {page.showTitle !== false ? (
        <header className="mx-auto w-full max-w-site px-gutter pb-2 pt-12">
          <h1 className="text-display-lg">{page.title}</h1>
        </header>
      ) : null}
      <PageBlocks blocks={page.layout} />
    </div>
  )
}

import type { MetadataRoute } from 'next'

import { getPayloadClient } from '@/lib/payload/getPayloadClient'

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/offers`, changeFrequency: 'weekly', priority: 0.6 },
    ...['about', 'contact', 'terms', 'privacy', 'cancellation-policy', 'help'].map((slug) => ({
      url: `${BASE_URL}/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
    })),
  ]

  try {
    const payload = await getPayloadClient()

    const [{ docs: properties }, { docs: localities }, { docs: pages }] = await Promise.all([
      payload.find({
        collection: 'properties',
        where: { status: { equals: 'approved' } },
        limit: 5000,
        depth: 0,
        select: { slug: true, updatedAt: true, propertyType: true, address: { city: true } },
        overrideAccess: true,
      }),
      payload.find({
        collection: 'localities',
        where: { isPopular: { equals: true } },
        limit: 100,
        depth: 0,
        select: { name: true, city: true },
        overrideAccess: true,
      }),
      // CMS pages, minus the ones their author asked search engines to skip.
      payload.find({
        collection: 'pages',
        where: {
          and: [{ _status: { equals: 'published' } }, { 'seo.noindex': { not_equals: true } }],
        },
        limit: 500,
        depth: 0,
        select: { slug: true, updatedAt: true },
        overrideAccess: true,
      }),
    ])

    const citiesByType = { hotel: new Set<string>(), resort: new Set<string>() }
    for (const property of properties) {
      const city = property.address?.city
      if (!city) continue
      const type = property.propertyType === 'resort' ? 'resort' : 'hotel'
      citiesByType[type].add(String(city))
    }

    return [
      ...staticRoutes,
      ...[...citiesByType.hotel].map((city) => ({
        url: `${BASE_URL}/hotels-in/${encodeURIComponent(city)}`,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      ...[...citiesByType.resort].map((city) => ({
        url: `${BASE_URL}/resorts-in/${encodeURIComponent(city)}`,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })),
      ...localities.map((locality) => ({
        url: `${BASE_URL}/hotels-in/${encodeURIComponent(locality.city)}?q=${encodeURIComponent(locality.name)}`,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })),
      ...pages.map((page) => ({
        url: `${BASE_URL}/${page.slug}`,
        lastModified: page.updatedAt ? new Date(page.updatedAt) : undefined,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })),
      ...properties.map((property) => ({
        url: `${BASE_URL}/property/${property.slug}`,
        lastModified: property.updatedAt ? new Date(property.updatedAt) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.9,
      })),
    ]
  } catch {
    return staticRoutes
  }
}

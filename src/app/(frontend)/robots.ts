import type { MetadataRoute } from 'next'

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/dashboard',
          '/partner',
          '/login',
          '/signup',
          '/forgot-password',
          '/reset-password',
          '/book',
          '/booking',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}

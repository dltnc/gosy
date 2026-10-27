import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Amenities } from './collections/Amenities'
import { Localities } from './collections/Localities'
import { Properties } from './collections/Properties'
import { RoomTypes } from './collections/RoomTypes'
import { Rooms } from './collections/Rooms'
import { Bookings } from './collections/Bookings'
import { Payments } from './collections/Payments'
import { Payouts } from './collections/Payouts'
import { Reviews } from './collections/Reviews'
import { Coupons } from './collections/Coupons'
import { LoyaltyPoints } from './collections/LoyaltyPoints'
import { SubscriptionPlans } from './collections/SubscriptionPlans'
import { PropertySubscriptions } from './collections/PropertySubscriptions'
import { SmsLogs } from './collections/SmsLogs'
import { EmailLogs } from './collections/EmailLogs'
import { Wishlist } from './collections/Wishlist'
import { Pages } from './collections/Pages'
import { PlatformSettings } from './globals/PlatformSettings'
import { IntegrationSettings } from './globals/IntegrationSettings'
import { AnalyticsSettings } from './globals/AnalyticsSettings'
import { dashboard } from './admin/dashboard'
import { runtimeEmailAdapter } from './lib/email/adapter'
import { jobsTasks } from './jobs'
import { searchEndpoint } from './endpoints/search'
import { suggestEndpoint } from './endpoints/suggest'
import { emailWebhookEndpoint } from './endpoints/email-webhook'
import { pricingQuoteEndpoint } from './endpoints/pricing-quote'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    dashboard,
  },
  collections: [
    Users,
    Media,
    Amenities,
    Localities,
    Properties,
    RoomTypes,
    Rooms,
    Bookings,
    Payments,
    Payouts,
    Reviews,
    Coupons,
    LoyaltyPoints,
    SubscriptionPlans,
    PropertySubscriptions,
    SmsLogs,
    EmailLogs,
    Wishlist,
    Pages,
  ],
  globals: [PlatformSettings, IntegrationSettings, AnalyticsSettings],
  endpoints: [searchEndpoint, suggestEndpoint, emailWebhookEndpoint, pricingQuoteEndpoint],
  jobs: {
    tasks: jobsTasks,
    autoRun: [
      {
        cron: '* * * * *',
        allQueues: true,
      },
    ],
    deleteJobOnComplete: false,
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  // Registered unconditionally: the adapter resolves its Resend credentials per send from the
  // `integration-settings` global (env vars as fallback), which cannot happen here because the
  // config is evaluated before any database connection exists.
  email: runtimeEmailAdapter,
  sharp,
  plugins: [
    ...(process.env.S3_BUCKET
      ? [
          s3Storage({
            collections: {
              media: {
                signedDownloads: {
                  // Once a CDN sits in front of the bucket, narrow this to
                  // payment_proof/invoice docs only so photo URLs become cacheable.
                  shouldUseSignedURL: async ({ req, filename }) => {
                    const { docs } = await req.payload.find({
                      collection: 'media',
                      where: { filename: { equals: filename } },
                      limit: 1,
                      depth: 0,
                      overrideAccess: true,
                    })
                    const purpose = docs[0]?.purpose ?? []
                    return purpose.includes('payment_proof') || purpose.includes('invoice')
                  },
                },
              },
            },
            bucket: process.env.S3_BUCKET,
            acl: 'private',
            disableLocalStorage: true,
            config: {
              region: process.env.S3_REGION || undefined,
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || '',
                secretAccessKey: process.env.S3_SECRET_KEY || '',
              },
            },
          }),
        ]
      : []),
  ],
})

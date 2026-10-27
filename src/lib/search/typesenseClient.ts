import { Client } from 'typesense'

let cached: Client | null = null

export const PROPERTIES_INDEX = 'properties'

export function getTypesenseClient(): Client | null {
  if (!process.env.TYPESENSE_HOST || !process.env.TYPESENSE_API_KEY) return null

  if (cached) return cached

  const [hostPart, portPart] = process.env.TYPESENSE_HOST.split(':')
  const port = Number(portPart || process.env.TYPESENSE_PORT || 8108)
  const protocol = process.env.TYPESENSE_PROTOCOL || (port === 443 ? 'https' : 'http')

  cached = new Client({
    nodes: [{ host: hostPart, port, protocol }],
    apiKey: process.env.TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 5,
  })

  return cached
}

export async function ensurePropertiesCollection(): Promise<boolean> {
  const client = getTypesenseClient()
  if (!client) return false

  try {
    const collection = await client.collections(PROPERTIES_INDEX).retrieve()
    await migrateSchemaFields(client, collection.fields)
    return true
  } catch {
    try {
      await client.collections().create({
        name: PROPERTIES_INDEX,
        fields: [
          { name: 'name', type: 'string' },
          { name: 'slug', type: 'string' },
          { name: 'city', type: 'string', facet: true },
          { name: 'localityName', type: 'string', facet: true, optional: true },
          { name: 'propertyType', type: 'string', facet: true },
          { name: 'tier', type: 'string', facet: true },
          { name: 'starRating', type: 'int32', optional: true },
          { name: 'avgRating', type: 'float' },
          { name: 'priceFrom', type: 'float' },
          { name: 'compareAtPriceFrom', type: 'float', optional: true },
          { name: 'amenityIds', type: 'string[]', facet: true, optional: true },
          { name: 'amenityNames', type: 'string[]', facet: true, optional: true },
          { name: 'trustBadges', type: 'string[]', facet: true, optional: true },
          { name: 'isFeatured', type: 'bool' },
          { name: 'featuredPriority', type: 'int32' },
          { name: 'featuredUntil', type: 'int64', optional: true },
          { name: 'location', type: 'geopoint', optional: true },
          { name: 'heroImageUrl', type: 'string', optional: true },
          { name: 'indexedAt', type: 'int64' },
        ],
        default_sorting_field: 'featuredPriority',
      })
      return true
    } catch {
      return false
    }
  }
}

const REQUIRED_FIELDS = [
  {
    name: 'propertyType',
    type: 'string' as const,
    facet: true,
    optional: true,
  },
  {
    name: 'compareAtPriceFrom',
    type: 'float' as const,
    optional: true,
  },
  {
    name: 'amenityNames',
    type: 'string[]' as const,
    facet: true,
    optional: true,
  },
  {
    // Added with the sponsored spotlight; existing indexes get it by alter rather than a rebuild.
    name: 'featuredUntil',
    type: 'int64' as const,
    optional: true,
  },
]

async function migrateSchemaFields(client: Client, existingFields: { name: string }[]) {
  const missing = REQUIRED_FIELDS.filter(
    (field) => !existingFields.some((existing) => existing.name === field.name),
  )
  if (missing.length === 0) return

  try {
    await client.collections(PROPERTIES_INDEX).update({ fields: [...missing] })
  } catch {
    // Older Typesense versions reject some alters; indexing errors are logged upstream.
  }
}

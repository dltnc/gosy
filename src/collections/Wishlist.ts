import type { CollectionConfig } from 'payload'
import { APIError, addDataAndFileToRequest } from 'payload'

const wishlistToggleEndpoint = {
  path: '/toggle',
  method: 'post',
  handler: async (req) => {
    if (!req.user) {
      throw new APIError('Please log in to save stays.', 401)
    }

    await addDataAndFileToRequest(req)
    const body = (req.data ?? {}) as { propertyId?: number | string }
    const propertyId = Number(body.propertyId)
    if (!Number.isFinite(propertyId)) {
      throw new APIError('propertyId is required.', 400)
    }

    const { docs } = await req.payload.find({
      collection: 'wishlist',
      where: {
        and: [{ guest: { equals: req.user.id } }, { property: { equals: propertyId } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (docs[0]) {
      await req.payload.delete({
        collection: 'wishlist',
        id: docs[0].id,
        overrideAccess: true,
      })
      return Response.json({ wishlisted: false })
    }

    await req.payload.create({
      collection: 'wishlist',
      data: { guest: req.user.id, property: propertyId },
      overrideAccess: true,
    })
    return Response.json({ wishlisted: true })
  },
} satisfies import('payload').Endpoint

export const Wishlist: CollectionConfig = {
  slug: 'wishlist',
  admin: {
    group: 'Guests',
    defaultColumns: ['guest', 'property', 'createdAt'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      return { guest: { equals: user.id } }
    },
    create: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
    update: () => false,
  },
  hooks: {
    beforeChange: [
      async ({ req, operation, data }) => {
        if (operation !== 'create') return data
        const guest = typeof data?.guest === 'object' ? data.guest.id : data?.guest
        const property =
          typeof data?.property === 'object' ? data.property.id : data?.property
        if (!guest || !property) throw new APIError('Guest and property are required.', 400)

        const { docs } = await req.payload.find({
          collection: 'wishlist',
          where: {
            and: [{ guest: { equals: guest } }, { property: { equals: property } }],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (docs[0]) {
          throw new APIError('This stay is already in your wishlist.', 409)
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'guest',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: () => false },
    },
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      required: true,
      index: true,
    },
  ],
  endpoints: [wishlistToggleEndpoint],
}

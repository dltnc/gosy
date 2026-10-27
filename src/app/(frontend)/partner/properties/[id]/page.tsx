import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PropertyForm, type PropertyFormValues } from '@/features/partner/components/property-form'
import { RoomTypesManager } from '@/features/partner/components/room-types-manager'
import { requirePartner } from '@/features/partner/guard'
import { richTextToPlainText } from '@/lib/richtext'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'Manage property',
}

interface EditPropertyPageProps {
  params: Promise<{ id: string }>
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  suspended: 'bg-red-100 text-red-700',
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = await params

  const { payload, user, isAdmin } = await requirePartner(`/partner/properties/${id}`)

  let property
  try {
    property = await payload.findByID({
      collection: 'properties',
      id: Number(id),
      depth: 1,
      overrideAccess: false,
      user,
    })
  } catch {
    return notFound()
  }

  if (!property) notFound()

  const partnerId =
    typeof property.partner === 'object' && property.partner !== null
      ? property.partner.id
      : property.partner
  // 404 rather than 403: a partner has no business learning that someone else's listing id exists.
  if (!isAdmin && Number(partnerId) !== Number(user.id)) notFound()

  const [{ docs: roomTypes }, { docs: allRooms }] = await Promise.all([
    payload.find({
      collection: 'room-types',
      where: { property: { equals: property.id } },
      sort: 'basePrice',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'rooms',
      where: { property: { equals: property.id } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  const roomsByType = new Map<number, typeof allRooms>()
  for (const room of allRooms) {
    const typeId = typeof room.roomType === 'object' ? room.roomType.id : room.roomType
    const list = roomsByType.get(Number(typeId)) ?? []
    list.push(room)
    roomsByType.set(Number(typeId), list)
  }

  const initialValues: PropertyFormValues = {
    id: Number(property.id),
    name: property.name,
    propertyType: property.propertyType === 'resort' ? 'resort' : 'hotel',
    tier: property.tier ?? 'standard',
    starRating: property.starRating != null ? String(property.starRating) : '',
    description: richTextToPlainText(property.description),
    streetAddress: property.address?.streetAddress ?? '',
    area: property.address?.area ?? '',
    city: property.address?.city ?? '',
    postcode: property.address?.postcode ?? '',
    country: property.address?.country ?? 'Bangladesh',
    contactPhone: property.contact?.phone ?? '',
    contactEmail: property.contact?.email ?? '',
    checkInTime: property.policies?.checkInTime ?? '14:00',
    checkOutTime: property.policies?.checkOutTime ?? '12:00',
    cancellationPolicy: property.policies?.cancellationPolicy ?? '',
    lat: Array.isArray(property.location) ? String(property.location[1]) : '',
    lng: Array.isArray(property.location) ? String(property.location[0]) : '',
  }

  const heroImageUrl =
    typeof property.heroImage === 'object' && property.heroImage !== null
      ? property.heroImage.url
      : null

  const initialGallery = (property.images ?? []).flatMap((entry) =>
    typeof entry.image === 'object' && entry.image !== null
      ? [
          {
            mediaId: Number(entry.image.id),
            url: entry.image.url ?? '',
            caption: entry.caption ?? '',
          },
        ]
      : [],
  )

  const initialVideos = (property.videos ?? []).map((entry) => ({
    url: entry.url,
    title: entry.title ?? '',
  }))

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link
          href="/partner/properties"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← All properties
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{property.name}</h1>
          <Badge
            variant="outline"
            className={`capitalize ${STATUS_STYLES[property.status ?? ''] ?? ''}`}
          >
            {property.status}
          </Badge>
          {(property.reviewCount ?? 0) > 0 ? (
            <span className="text-sm text-muted-foreground">
              ★ {property.avgRating} ({property.reviewCount})
            </span>
          ) : null}
        </div>
        {property.status === 'rejected' || property.status === 'suspended' ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            This listing is currently {property.status}. Update the details and contact the platform
            to have it reviewed again.
          </p>
        ) : null}
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Listing details</h2>
        <PropertyForm
          mode="edit"
          initial={initialValues}
          heroImageUrl={heroImageUrl}
          initialGallery={initialGallery}
          initialVideos={initialVideos}
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Room types & inventory</h2>
          <p className="text-sm text-muted-foreground">
            Guests book specific physical rooms — add at least one room per type.
          </p>
        </div>
        <RoomTypesManager
          propertyId={Number(property.id)}
          roomTypes={roomTypes.map((roomType) => ({
            id: Number(roomType.id),
            name: roomType.name,
            basePrice: roomType.basePrice,
            maxOccupancy: roomType.maxOccupancy ?? null,
            bedConfiguration: roomType.bedConfiguration,
            isActive: Boolean(roomType.isActive),
            rooms: (roomsByType.get(Number(roomType.id)) ?? []).map((room) => ({
              id: Number(room.id),
              roomNumber: room.roomNumber,
              floor: room.floor ?? null,
              isActive: Boolean(room.isActive),
            })),
          }))}
        />
      </section>
    </div>
  )
}

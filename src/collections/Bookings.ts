import type {
  Access,
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  Payload,
  Where,
} from 'payload'
import { APIError } from 'payload'
import { adminsOnly } from '../lib/access/predicates'
import { findOverlappingBookingRooms } from '../lib/availability/checkOverlap'
import { BOOKING_ACTIVE_STATUSES, isValidTransition } from '../lib/bookings/statuses'
import { computeNights, computePricing } from '../lib/pricing/computePricing'
import { validateCoupon, type CouponForValidation } from '../lib/coupons/validateCoupon'
import { validateRedemption } from '../lib/loyalty/validateRedemption'
import {
  postLedgerEntry,
  postBookingRedemption,
  refundBookingRedemption,
} from '../lib/loyalty/ledger'
import { checkoutEndpoint } from '../endpoints/checkout'
import {
  sendBookingCancelledEmail,
  sendBookingConfirmationEmail,
  sendPartnerNewBookingEmail,
} from '../lib/email/send'

const CANCELLED_STATUSES = ['cancelled_by_guest', 'cancelled_by_partner']

function resolveId(value: unknown): string | number | undefined {
  if (value == null || value === '') return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: string | number }).id
    if (id != null) return id
  }
  return undefined
}

function toCouponForValidation(coupon: unknown): CouponForValidation {
  const c = (coupon ?? {}) as Record<string, unknown>
  return {
    code: String(c.code ?? ''),
    active: Boolean(c.active),
    validFrom: (c.validFrom as string | null) ?? null,
    validUntil: (c.validUntil as string | null) ?? null,
    discountType: c.discountType as 'percent' | 'fixed',
    discountValue: Number(c.discountValue ?? 0),
    maxDiscountAmount: (c.maxDiscountAmount as number | null) ?? null,
    minBookingAmount: (c.minBookingAmount as number | null) ?? null,
    usageLimitTotal: (c.usageLimitTotal as number | null) ?? null,
    usesPerUser: (c.usesPerUser as number | null) ?? null,
    firstBookingOnly: Boolean(c.firstBookingOnly),
    scope: c.scope as CouponForValidation['scope'],
    scopeProperties: (c.scopeProperties as CouponForValidation['scopeProperties']) ?? null,
    scopeTier: (c.scopeTier as string | null) ?? null,
    scopeCity: (c.scopeCity as string | null) ?? null,
    currentUsageCount: (c.currentUsageCount as number | null) ?? null,
  }
}

async function generateUniqueBookingRef(payload: Payload): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = `BK-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`
    const { totalDocs } = await payload.count({
      collection: 'bookings',
      where: { bookingRef: { equals: ref } },
    })
    if (totalDocs === 0) return ref
  }
  throw new APIError('Could not generate a unique booking reference.', 500)
}

interface DraftItem {
  roomType?: unknown
  room?: unknown
  nightlyRate?: number | null
  nights?: number | null
  lineSubtotal?: number | null
}

function draftItems(data: Record<string, unknown> | undefined): DraftItem[] {
  const items = data?.items
  return Array.isArray(items) ? (items as DraftItem[]) : []
}

/**
 * Rate per night for each room on the booking, one entry per row.
 *
 * A row's stored `nightlyRate` wins: it is what the guest was quoted, and a later price change to the
 * room type must not silently re-price a booking that already exists. Only rows without a rate — an
 * admin adding a room by hand in the panel — fall back to the room type's current `basePrice`.
 */
async function resolveRoomRates(payload: Payload, items: DraftItem[]): Promise<number[]> {
  const missing = items.filter((item) => typeof item.nightlyRate !== 'number')
  const basePriceByRoomType = new Map<string, number>()

  if (missing.length > 0) {
    const ids = [...new Set(missing.map((item) => resolveId(item.roomType)).filter(Boolean))]
    if (ids.length > 0) {
      const { docs } = await payload.find({
        collection: 'room-types',
        where: { id: { in: ids as (string | number)[] } },
        limit: ids.length,
        depth: 0,
        overrideAccess: true,
        select: { basePrice: true },
      })
      for (const roomType of docs) {
        basePriceByRoomType.set(String(roomType.id), roomType.basePrice ?? 0)
      }
    }
  }

  return items.map((item) =>
    typeof item.nightlyRate === 'number'
      ? item.nightlyRate
      : (basePriceByRoomType.get(String(resolveId(item.roomType))) ?? 0),
  )
}

const generateRefAndDeriveRoomData: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  if (operation === 'create') {
    if (!data.bookingRef) {
      data.bookingRef = await generateUniqueBookingRef(req.payload)
    }
    if (!data.guest && req.user?.id) {
      data.guest = req.user.id
    }
  }

  const items = draftItems(data)

  // Only re-derive when the rows are actually part of this write; a status-only update must not have
  // to resend them.
  if (operation === 'create' || Array.isArray(data.items)) {
    if (items.length === 0) {
      throw new APIError('A booking needs at least one room.', 400)
    }

    const roomIds = items.map((item) => resolveId(item.room))
    if (roomIds.some((id) => id == null)) {
      throw new APIError('Every room row must name a room.', 400)
    }
    if (new Set(roomIds.map(String)).size !== roomIds.length) {
      throw new APIError('The same room cannot be booked twice on one booking.', 400)
    }

    const { docs: rooms } = await req.payload.find({
      collection: 'rooms',
      where: { id: { in: roomIds as (string | number)[] } },
      limit: roomIds.length,
      depth: 1,
      overrideAccess: true,
    })

    if (rooms.length !== roomIds.length) {
      throw new APIError('One of the selected rooms no longer exists.', 400)
    }

    const roomsById = new Map(rooms.map((room) => [String(room.id), room]))
    const propertyIds = new Set<string>()

    for (const item of items) {
      const room = roomsById.get(String(resolveId(item.room)))!

      if (!room.isActive) {
        throw new APIError(`Room ${room.roomNumber ?? room.id} is not currently bookable.`, 400)
      }

      const property = typeof room.property === 'object' ? room.property : null
      if (property?.status !== 'approved') {
        throw new APIError('The property for this room is not open for bookings.', 400)
      }

      propertyIds.add(String(resolveId(room.property)))
      // Derived from the room, never taken from the client: the two must not disagree.
      item.roomType = resolveId(room.roomType)!
    }

    if (propertyIds.size > 1) {
      throw new APIError('All rooms on one booking must belong to the same property.', 400)
    }

    data.property = resolveId(rooms[0]!.property)!
    // Mirrors for list columns, reporting and the single-room views that have not been widened yet.
    data.roomType = resolveId(items[0]!.roomType)!
    data.room = resolveId(items[0]!.room)!
  }

  const checkIn = data.checkInDate ?? originalDoc?.checkInDate
  const checkOut = data.checkOutDate ?? originalDoc?.checkOutDate

  if (operation === 'create' || data.checkInDate !== undefined || data.checkOutDate !== undefined) {
    if (!checkIn || !checkOut) {
      throw new APIError('Both check-in and check-out dates are required.', 400)
    }
    if (computeNights(checkIn, checkOut) < 1) {
      throw new APIError('Check-out must be at least one night after check-in.', 400)
    }
    if (new Date(checkIn).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
      throw new APIError('Check-in date cannot be in the past.', 400)
    }
  }

  return data
}

const validateAvailabilityCouponsAndPoints: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const items = draftItems(data).length > 0 ? draftItems(data) : draftItems(originalDoc)
  const checkIn = data.checkInDate ?? originalDoc?.checkInDate
  const checkOut = data.checkOutDate ?? originalDoc?.checkOutDate
  const roomIds = items.map((item) => resolveId(item.room)).filter(Boolean) as (string | number)[]

  const previousRoomIds = draftItems(originalDoc)
    .map((item) => resolveId(item.room))
    .filter(Boolean)
    .map(String)
  const roomsChanged =
    Array.isArray(data.items) &&
    (previousRoomIds.length !== roomIds.length ||
      roomIds.some((id, index) => String(id) !== previousRoomIds[index]))

  const datesChanged =
    operation === 'create' ||
    roomsChanged ||
    (data.checkInDate !== undefined && data.checkInDate !== originalDoc?.checkInDate) ||
    (data.checkOutDate !== undefined && data.checkOutDate !== originalDoc?.checkOutDate)

  if (roomIds.length === 0 || !checkIn || !checkOut) {
    throw new APIError('Rooms and stay dates are required.', 400)
  }

  if (datesChanged) {
    const taken = await findOverlappingBookingRooms(req.payload, {
      roomIds,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      excludeBookingId: operation === 'update' ? originalDoc?.id : undefined,
    })
    if (taken.size > 0) {
      throw new APIError(
        taken.size === roomIds.length
          ? 'These rooms are no longer available for the selected dates.'
          : `${taken.size} of the selected rooms ${taken.size === 1 ? 'is' : 'are'} no longer available for these dates.`,
        409,
      )
    }
  }

  // The party has to fit. Checked against the sum over all rooms, so a 6-person group across three
  // doubles is fine while the same group in one double is not.
  const adults = data.adults ?? originalDoc?.adults ?? 0
  const children = data.children ?? originalDoc?.children ?? 0
  if (datesChanged || data.adults !== undefined || data.children !== undefined) {
    const roomTypeIds = [...new Set(items.map((item) => resolveId(item.roomType)).filter(Boolean))]
    if (roomTypeIds.length > 0) {
      const { docs: roomTypes } = await req.payload.find({
        collection: 'room-types',
        where: { id: { in: roomTypeIds as (string | number)[] } },
        limit: roomTypeIds.length,
        depth: 0,
        overrideAccess: true,
        select: { maxOccupancy: true },
      })
      const occupancyByRoomType = new Map(
        roomTypes.map((roomType) => [String(roomType.id), roomType.maxOccupancy ?? 0]),
      )
      const capacity = items.reduce(
        (sum, item) => sum + (occupancyByRoomType.get(String(resolveId(item.roomType))) ?? 0),
        0,
      )
      if (capacity > 0 && adults + children > capacity) {
        throw new APIError(
          `The selected rooms sleep ${capacity} guest${capacity === 1 ? '' : 's'}; you have entered ${
            adults + children
          }. Add another room or reduce the party.`,
          400,
        )
      }
    }
  }

  const nights = computeNights(checkIn, checkOut)
  const roomRates = await resolveRoomRates(req.payload, items)
  const subtotal = Math.round(roomRates.reduce((sum, rate) => sum + rate, 0) * nights * 100) / 100

  const couponId = resolveId(data.couponApplied)
  if (couponId && couponId !== resolveId(originalDoc?.couponApplied)) {
    const coupon = await req.payload.findByID({
      collection: 'coupons',
      id: couponId,
      depth: 0,
    })

    const guestId = resolveId(data.guest) ?? resolveId(originalDoc?.guest) ?? req.user?.id
    const propertyId = resolveId(data.property) ?? resolveId(originalDoc?.property)

    let tier: string | undefined
    let city: string | undefined
    if (propertyId) {
      const property = await req.payload.findByID({
        collection: 'properties',
        id: propertyId,
        depth: 0,
        select: { tier: true, address: true },
      })
      tier = property.tier ?? undefined
      city = property.address?.city ?? undefined
    }

    let userUsageCount = 0
    let isFirstBooking = true
    if (guestId) {
      const [{ totalDocs: usageCount }, { totalDocs: priorBookings }] = await Promise.all([
        req.payload.count({
          collection: 'bookings',
          where: {
            and: [
              { guest: { equals: guestId } },
              { couponApplied: { equals: couponId } },
              ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
            ],
          },
        }),
        req.payload.count({
          collection: 'bookings',
          where: {
            and: [
              { guest: { equals: guestId } },
              { status: { in: [...BOOKING_ACTIVE_STATUSES, 'checked_out'] } },
              ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : []),
            ],
          },
        }),
      ])
      userUsageCount = usageCount
      isFirstBooking = priorBookings === 0
    }

    const result = validateCoupon(toCouponForValidation(coupon), {
      subtotal,
      propertyId: propertyId ?? '',
      propertyTier: tier,
      propertyCity: city,
      userUsageCount,
      isFirstBooking,
    })

    if (!result.ok) {
      throw new APIError(result.reason ?? 'This coupon cannot be applied.', 400)
    }
  }

  const pointsRedeemed = data.pointsRedeemed ?? originalDoc?.pointsRedeemed ?? 0
  const pointsChanged =
    operation === 'create' || pointsRedeemed !== (originalDoc?.pointsRedeemed ?? 0)

  if (pointsChanged && pointsRedeemed > 0) {
    const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })
    const loyalty = settings.loyaltyProgram

    if (!loyalty?.enabled) {
      throw new APIError('Points redemption is disabled.', 400)
    }

    const guestId = resolveId(data.guest) ?? resolveId(originalDoc?.guest) ?? req.user?.id
    if (!guestId) throw new APIError('A guest account is required to redeem points.', 400)

    const guest = await req.payload.findByID({
      collection: 'users',
      id: guestId,
      depth: 0,
      select: { pointsBalance: true },
    })

    let couponDiscount = 0
    const couponIdForPoints = resolveId(data.couponApplied) ?? resolveId(originalDoc?.couponApplied)
    if (couponIdForPoints) {
      const coupon = await req.payload.findByID({
        collection: 'coupons',
        id: couponIdForPoints,
        depth: 0,
      })
      const discount =
        coupon.discountType === 'percent'
          ? (subtotal * coupon.discountValue) / 100
          : coupon.discountValue
      couponDiscount = Math.min(
        Math.max(discount, 0),
        coupon.maxDiscountAmount != null && coupon.maxDiscountAmount > 0
          ? coupon.maxDiscountAmount
          : Number.MAX_SAFE_INTEGER,
        subtotal,
      )
    }

    const result = validateRedemption(
      pointsRedeemed,
      guest.pointsBalance ?? 0,
      {
        redeemRate: loyalty.redeemRate ?? 0,
        minRedeemPoints: loyalty.minRedeemPoints ?? 0,
        maxRedeemPercentOfBooking: loyalty.maxRedeemPercentOfBooking ?? 0,
      },
      subtotal - couponDiscount,
    )
    if (!result.ok) {
      throw new APIError(result.reason ?? 'Points redemption failed validation.', 400)
    }
  }

  return data
}

const enforceTransitionsAndComputePricing: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
  originalDoc,
}) => {
  if (operation === 'update' && originalDoc && data.status && data.status !== originalDoc.status) {
    if (!isValidTransition(originalDoc.status, data.status)) {
      throw new APIError(`Cannot move a booking from ${originalDoc.status} to ${data.status}.`, 400)
    }
  }

  if (operation !== 'create') return data

  const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })

  const items = draftItems(data)
  const nights = computeNights(data.checkInDate, data.checkOutDate)
  const roomRates = await resolveRoomRates(req.payload, items)

  // Freeze the quote onto each row, so an invoice reprinted a year later still shows what was charged.
  data.items = items.map((item, index) => ({
    ...item,
    nightlyRate: roomRates[index] ?? 0,
    nights,
    lineSubtotal: Math.round((roomRates[index] ?? 0) * nights * 100) / 100,
  }))

  const propertyId = resolveId(data.property)!
  const property = await req.payload.findByID({
    collection: 'properties',
    id: propertyId,
    depth: 0,
    select: { commissionRateOverride: true },
  })
  const overrideRate: number | null | undefined = property.commissionRateOverride

  let coupon: CouponForValidation | null = null
  const couponId = resolveId(data.couponApplied)
  if (couponId) {
    const fetched = await req.payload.findByID({
      collection: 'coupons',
      id: couponId,
      depth: 0,
    })
    coupon = toCouponForValidation(fetched)
  }

  const pricing = computePricing({
    roomRates,
    checkInDate: data.checkInDate,
    checkOutDate: data.checkOutDate,
    commissionRate: overrideRate ?? settings.defaultCommissionRate,
    coupon,
    pointsRedeemed: data.pointsRedeemed ?? 0,
    redeemRate: settings.loyaltyProgram?.redeemRate ?? 0,
    maxRedeemPercentOfBooking: settings.loyaltyProgram?.maxRedeemPercentOfBooking ?? 0,
  })

  data.pricing = pricing
  data.currency = settings.currency

  return data
}

const postSideEffects: CollectionAfterChangeHook = async ({
  doc,
  req,
  operation,
  previousDoc,
  context,
}) => {
  if (context.skipBookingSideEffects) return doc

  // Debit redeemed points first: this can throw on an overdrawn balance, and
  // rolling the booking back is cheaper than having already emailed the partner.
  if (operation === 'create') {
    await postBookingRedemption(req.payload, doc, req)
  }

  const becameCheckedOut =
    operation === 'update' && doc.status === 'checked_out' && previousDoc.status !== 'checked_out'

  if (becameCheckedOut) {
    const { totalDocs: existingEarnRows } = await req.payload.count({
      collection: 'loyalty-points',
      where: {
        and: [{ sourceBooking: { equals: doc.id } }, { type: { equals: 'earn' } }],
      },
    })

    if (existingEarnRows === 0) {
      const settings = await req.payload.findGlobal({ slug: 'platform-settings', depth: 0 })
      const loyalty = settings.loyaltyProgram
      const earnRate = loyalty?.earnRatePer100Spent ?? 0

      if (loyalty?.enabled && earnRate > 0) {
        const pointsEarned = Math.floor((doc.pricing.totalAmount / 100) * earnRate)

        if (pointsEarned > 0) {
          const expiresAt = new Date()
          expiresAt.setDate(expiresAt.getDate() + (loyalty.pointsExpireAfterDays ?? 365))

          await postLedgerEntry(
            req.payload,
            {
              user: resolveId(doc.guest)!,
              type: 'earn',
              amount: pointsEarned,
              sourceBooking: doc.id,
              expiresAt,
              notes: `Earned from booking ${doc.bookingRef}`,
            },
            req,
          )
        }
      }
    }
  }

  const wasCancelled =
    operation === 'update' &&
    CANCELLED_STATUSES.includes(doc.status) &&
    !CANCELLED_STATUSES.includes(previousDoc.status)

  if (wasCancelled) {
    // Give back whatever the guest redeemed towards this stay.
    await refundBookingRedemption(req.payload, doc, req)

    const { totalDocs: earnedRows } = await req.payload.count({
      collection: 'loyalty-points',
      where: {
        and: [{ sourceBooking: { equals: doc.id } }, { type: { equals: 'earn' } }],
      },
    })
    const { totalDocs: reversedRows } = await req.payload.count({
      collection: 'loyalty-points',
      where: {
        and: [{ sourceBooking: { equals: doc.id } }, { type: { equals: 'reverse' } }],
      },
    })

    if (earnedRows > 0 && reversedRows === 0) {
      const { docs } = await req.payload.find({
        collection: 'loyalty-points',
        where: {
          and: [{ sourceBooking: { equals: doc.id } }, { type: { equals: 'earn' } }],
        },
        limit: 1,
        depth: 0,
        sort: '-createdAt',
      })

      if (docs[0]) {
        await postLedgerEntry(
          req.payload,
          {
            user: resolveId(docs[0].user)!,
            type: 'reverse',
            amount: Math.abs(docs[0].amount),
            sourceBooking: doc.id,
            notes: `Reversed earning from cancelled booking ${doc.bookingRef}`,
          },
          req,
        )
      }
    }

    const populated = await req.payload.findByID({
      collection: 'bookings',
      id: doc.id,
      depth: 2,
      overrideAccess: true,
      req,
    })
    await sendBookingCancelledEmail(req.payload, populated)
  }

  const becameConfirmed =
    operation === 'update' && doc.status === 'confirmed' && previousDoc.status !== 'confirmed'

  if (becameConfirmed) {
    const populated = await req.payload.findByID({
      collection: 'bookings',
      id: doc.id,
      depth: 2,
      overrideAccess: true,
      req,
    })
    await sendBookingConfirmationEmail(req.payload, populated)
  }

  if (operation === 'create') {
    const populated = await req.payload.findByID({
      collection: 'bookings',
      id: doc.id,
      depth: 2,
      overrideAccess: true,
      req,
    })
    await sendPartnerNewBookingEmail(req.payload, populated)
  }

  const couponId = resolveId(doc.couponApplied)
  if (couponId) {
    const shouldIncrement =
      operation === 'create' &&
      doc.status !== 'cancelled_by_guest' &&
      doc.status !== 'cancelled_by_partner'

    if (shouldIncrement) {
      const coupon = await req.payload.findByID({
        collection: 'coupons',
        id: couponId,
        depth: 0,
        select: { currentUsageCount: true },
      })
      await req.payload.update({
        collection: 'coupons',
        id: couponId,
        data: { currentUsageCount: (coupon.currentUsageCount ?? 0) + 1 },
        context: { skipCouponHooks: true },
        req,
      })
    }
  }

  return doc
}

const bookingsRead: Access = ({ req: { user } }) => {
  if (!user) return false
  if (user.role === 'admin') return true
  if (user.role === 'partner') {
    const partnerScope: Where = {
      or: [{ 'property.partner': { equals: user.id } }, { guest: { equals: user.id } }],
    }
    return partnerScope
  }
  const guestScope: Where = { guest: { equals: user.id } }
  return guestScope
}

const bookingsUpdate: Access = ({ req: { user } }) => {
  if (user?.role === 'admin') return true
  if (user?.role === 'partner') {
    const partnerScope: Where = {
      and: [
        { 'property.partner': { equals: user.id } },
        { status: { in: ['pending_payment', 'confirmed'] } },
      ],
    }
    return partnerScope
  }
  return false
}

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  endpoints: [checkoutEndpoint],
  admin: {
    useAsTitle: 'bookingRef',
    defaultColumns: [
      'bookingRef',
      'guest',
      'property',
      'roomType',
      'checkInDate',
      'status',
      'pricing.totalAmount',
    ],
    group: 'Transactions',
    listSearchableFields: ['bookingRef'],
    description:
      'Bookings are created through the checkout endpoint. Pricing is always computed server-side.',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: bookingsRead,
    update: bookingsUpdate,
    delete: adminsOnly,
  },
  hooks: {
    beforeValidate: [generateRefAndDeriveRoomData, validateAvailabilityCouponsAndPoints],
    beforeChange: [enforceTransitionsAndComputePricing],
    afterChange: [postSideEffects],
  },
  fields: [
    {
      name: 'bookingRef',
      label: 'Booking Reference',
      type: 'text',
      unique: true,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
      access: { update: () => false },
    },
    {
      name: 'guest',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      access: { update: () => false },
      filterOptions: { role: { in: ['guest', 'partner', 'admin'] } },
    },
    {
      name: 'property',
      type: 'relationship',
      relationTo: 'properties',
      required: true,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Derived from the selected room.',
      },
      access: { update: () => false },
    },
    {
      name: 'items',
      label: 'Rooms',
      type: 'array',
      minRows: 1,
      labels: { singular: 'Room', plural: 'Rooms' },
      admin: {
        description:
          'One row per physical room for the whole stay. Three rooms of the same type is three rows; a mixed party is one row per room. Rates are captured at booking time and never re-read from the room type.',
        initCollapsed: false,
      },
      access: { update: () => false },
      fields: [
        {
          name: 'roomType',
          type: 'relationship',
          relationTo: 'room-types',
          required: true,
          index: true,
        },
        {
          name: 'room',
          type: 'relationship',
          relationTo: 'rooms',
          required: true,
          index: true,
          filterOptions: ({ data }) => {
            const property = resolveId((data as { property?: unknown } | undefined)?.property)
            return property ? { property: { equals: property } } : true
          },
        },
        {
          name: 'nightlyRate',
          type: 'number',
          min: 0,
          admin: { readOnly: true, description: 'Rate held for this room at booking time.' },
        },
        { name: 'nights', type: 'number', min: 1, admin: { readOnly: true } },
        { name: 'lineSubtotal', type: 'number', min: 0, admin: { readOnly: true } },
      ],
    },
    {
      name: 'roomType',
      label: 'Primary room type',
      type: 'relationship',
      relationTo: 'room-types',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Mirror of the first row of Rooms, kept for list columns and reporting.',
      },
      access: { update: () => false },
    },
    {
      name: 'room',
      label: 'Primary room',
      type: 'relationship',
      relationTo: 'rooms',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Mirror of the first row of Rooms. Availability is checked against Rooms, not this.',
      },
      access: { update: () => false },
    },
    {
      name: 'checkInDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
      access: { update: ({ req }) => req.user?.role !== 'guest' },
    },
    {
      name: 'checkOutDate',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayOnly' } },
      access: { update: ({ req }) => req.user?.role !== 'guest' },
    },
    {
      name: 'adults',
      type: 'number',
      defaultValue: 2,
      min: 1,
    },
    {
      name: 'children',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Pending Payment', value: 'pending_payment' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Checked In', value: 'checked_in' },
        { label: 'Checked Out', value: 'checked_out' },
        { label: 'Cancelled by Guest', value: 'cancelled_by_guest' },
        { label: 'Cancelled by Partner', value: 'cancelled_by_partner' },
        { label: 'No Show', value: 'no_show' },
      ],
      defaultValue: 'pending_payment',
      index: true,
    },
    {
      name: 'currency',
      type: 'text',
      admin: { position: 'sidebar', readOnly: true },
      access: { update: () => false },
    },
    {
      name: 'pricing',
      type: 'group',
      admin: {
        readOnly: true,
        description: 'Computed server-side on creation. Never trust client values.',
      },
      access: { update: () => false },
      fields: [
        { name: 'nights', type: 'number', min: 1 },
        { name: 'subtotal', type: 'number', min: 0 },
        { name: 'commissionRate', type: 'number', min: 0, max: 100 },
        { name: 'commissionAmount', type: 'number', min: 0 },
        { name: 'partnerPayoutAmount', type: 'number', min: 0 },
        { name: 'couponDiscountAmount', type: 'number', min: 0 },
        { name: 'pointsDiscountAmount', type: 'number', min: 0 },
        { name: 'totalAmount', type: 'number', min: 0 },
      ],
    },
    {
      name: 'couponApplied',
      label: 'Coupon Applied',
      type: 'relationship',
      relationTo: 'coupons',
      access: { update: ({ req }) => req.user?.role !== 'guest' },
    },
    {
      name: 'pointsRedeemed',
      label: 'Points Redeemed',
      type: 'number',
      defaultValue: 0,
      min: 0,
      access: { update: ({ req }) => req.user?.role !== 'guest' },
    },
    {
      name: 'guestPhone',
      label: 'Guest Phone',
      type: 'text',
      admin: {
        description: 'Contact number captured at checkout for this booking.',
      },
    },
    {
      name: 'specialRequests',
      type: 'textarea',
    },
    {
      name: 'invoicePdf',
      label: 'Invoice PDF',
      type: 'upload',
      relationTo: 'media',
      maxDepth: 0,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Generated automatically after payment success.',
      },
      access: { update: () => false },
    },
  ],
}

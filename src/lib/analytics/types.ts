import type { BookingStatus } from '@/lib/bookings/statuses'

/**
 * Shared shapes for the admin executive dashboard.
 *
 * Everything here is plain data: the aggregation functions in `metrics.ts` are pure and
 * dependency-free so they can be unit-tested without a database, and the widget server
 * components in `src/components/admin/widgets` only ever pass these shapes to the client.
 */

export type Granularity = 'day' | 'week' | 'month'

export type RangePreset = '7d' | '30d' | '90d' | '12m' | 'ytd'

export interface AnalyticsRange {
  /** Inclusive start of the window, as an absolute instant. */
  from: Date
  /** Exclusive end of the window, as an absolute instant. */
  to: Date
  granularity: Granularity
  preset: RangePreset
  /** Human label for the window, e.g. "Last 30 days". */
  label: string
  /** Whole days covered by the window — used for RevPAR denominators. */
  days: number
}

/** One physical room on a booking, priced with the rate frozen onto it at booking time. */
export interface BookingRoomRecord {
  roomTypeId: number | null
  /** Nights charged on this row. Normally the stay length, but it is frozen per row. */
  nights: number
  /** Gross charge for this row, before coupon and points. */
  subtotal: number
}

/** Slim booking projection. Relationships stay as numeric ids and are joined in JS. */
export interface BookingRecord {
  id: number
  status: BookingStatus
  createdAt: string
  checkInDate: string
  checkOutDate: string
  propertyId: number | null
  /**
   * Every room on the booking, so revenue can be attributed per room type. Never empty: bookings
   * written before rooms became line items contribute one synthetic row from the `roomType` mirror.
   */
  rooms: BookingRoomRecord[]
  /** Physical rooms booked — the multiplier occupancy needs. */
  roomCount: number
  /** Room-nights sold: rooms × their nights. `nights` alone is stay length, not volume. */
  roomNights: number
  /** Length of the stay in nights. */
  nights: number
  subtotal: number
  totalAmount: number
  commissionAmount: number
  couponDiscountAmount: number
  pointsDiscountAmount: number
}

export interface PaymentRecord {
  id: number
  gateway: 'aamarpay' | 'bank_transfer' | 'bkash' | 'manual' | 'nagad' | 'sslcommerz'
  status: 'cancelled' | 'failed' | 'initiated' | 'pending' | 'refunded' | 'success'
  purpose: 'booking_payment' | 'refund' | 'subscription_payment'
  amount: number
  createdAt: string
}

export interface PropertyRecord {
  id: number
  name: string
  city: string
  tier: 'budget' | 'flagship' | 'premium' | 'standard'
  propertyType: 'hotel' | 'resort'
  status: 'approved' | 'draft' | 'pending' | 'rejected' | 'suspended'
  freeCancellation: boolean
}

export interface RoomTypeRecord {
  id: number
  name: string
  propertyId: number | null
}

/** One active, bookable room. Used for inventory and RevPAR denominators. */
export interface RoomRecord {
  id: number
  propertyId: number | null
}

export interface TimeBucket {
  /** ISO date (YYYY-MM-DD) marking the start of the bucket in market-local time. */
  key: string
  label: string
  /** Gross booking value of every reservation created in the bucket. */
  gbv: number
  /** GBV of reservations created in the bucket that were later cancelled or no-showed. */
  cancelledGbv: number
  /** Cash the guest actually owes, net of coupon and points, on live reservations. */
  netCash: number
  /** Platform commission on live reservations. */
  commission: number
  /** Reservations created in the bucket. */
  bookings: number
  cancelled: number
}

export interface KpiSummary {
  gbv: number
  netCash: number
  commission: number
  /** commission / gross subtotal, as a percentage. */
  takeRatePct: number
  /** commission / cash actually collected — higher than takeRatePct when discounts are heavy. */
  effectiveTakeRatePct: number
  /** Average daily rate: realised gross revenue per room-night sold. */
  adr: number
  /** Revenue per available room-night. */
  revpar: number
  roomNightsSold: number
  roomNightsAvailable: number
  occupancyPct: number
  bookings: number
  cancellations: number
  cancellationRatePct: number
  /** Discount given away, i.e. coupon + points across live reservations. */
  discountGiven: number
}

export interface FunnelStage {
  key: string
  label: string
  value: number
  /** Share of all reservations created in the window. */
  pct: number
}

export interface CancellationGroup {
  key: string
  label: string
  total: number
  cancelledByGuest: number
  cancelledByPartner: number
  noShow: number
  cancellationRatePct: number
}

export interface RoomTypeRevenue {
  key: string
  label: string
  revenue: number
  bookings: number
  roomNights: number
  adr: number
}

export interface CityOccupancy {
  key: string
  label: string
  roomNightsBooked: number
  roomNightsAvailable: number
  occupancyPct: number
  properties: number
  rooms: number
}

export interface GatewaySlice {
  key: string
  label: string
  attempts: number
  successes: number
  amount: number
  successRatePct: number
}

export interface SupplySnapshot {
  approvedProperties: number
  pendingProperties: number
  suspendedProperties: number
  activeRooms: number
  activeRoomTypes: number
  citiesCovered: number
}

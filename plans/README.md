# Hotel/Resort Booking Platform — Payload CMS Data Model

## Collections overview

| Collection | Purpose |
|---|---|
| `users` | Guests, property partners, and admins (single collection, `role` field), with a cached `pointsBalance` for guests |
| `amenities` | Reusable tags (Pool, Parking, AC, TV...) shared by properties & room types |
| `properties` | A hotel/resort listing, owned by a `users` doc with `role: partner` |
| `room-types` | A category of room within a property (e.g. "Deluxe Double") |
| `rooms` | Individual physical room units belonging to a room type |
| `bookings` | A reservation of one room for a date range, by a guest — now also carries points redemption/earning |
| `payments` | Every transaction — bKash, Nagad, SSLCommerz, AmarPay, bank transfer, or manual/cash — for bookings AND subscriptions |
| `loyalty-points` | Append-only ledger of points earned/redeemed/expired/adjusted per user |
| `reviews` | Guest review tied 1:1 to a completed booking |
| `coupons` | Marketing promo codes — a separate discount mechanism from loyalty points, can stack with them |
| `localities` | Admin-curated neighborhood/area layer between city and street, for locality filters and landing pages |
| `subscription-plans` | Admin-defined tiers (Basic/Premium/Platinum) for featured placement |
| `property-subscriptions` | A property's purchase of a subscription plan (with start/end dates) |
| `platform-settings` (global) | Default commission %, currency, payment gateway config, loyalty program rules |

## Payment gateway integration plan

Researched existing GitHub/npm libraries rather than building raw API clients from scratch:

| Gateway | Package | Integration shape |
|---|---|---|
| bKash | [`bkash-payment-gateway`](https://github.com/shahriar-shojib/bkash-payment-gateway) or [`bkash-js`](https://github.com/ShejanMahamud/bkash-js) | Tokenized checkout: create → user approves in-app/USSD → your `success_url` receives `paymentID` → you call `execute` to actually capture funds |
| Nagad | [`nagad-payment-gateway`](https://github.com/shahriar-shojib/nagad-payment-gateway) | Handles Nagad's RSA request signing internally. Low download count, so it's wrapped behind an adapter (`lib/payments/nagad.adapter.ts`) that's swappable if you outgrow it |
| SSLCommerz | [`sslcommerz-lts`](https://github.com/sslcommerz/SSLCommerz-NodeJS) | Official package, actively published. Redirect-based checkout aggregating cards + mobile banking + net banking behind one flow |
| AmarPay | Plain `fetch` (no maintained SDK — the `aamarpay` npm package is 5 years stale) | Simple JSON POST to `jsonpost.php`, redirect-based like the others |
| Bank Transfer | No gateway — manual | Guest sees the platform's bank account(s) from `platform-settings`, uploads a transfer receipt, admin/partner verifies manually |
| Manual/Cash | No gateway — manual | Admin/partner records an offline payment (e.g. paid at front desk) directly |

All four API-based gateways sit behind one `PaymentGateway` interface (`lib/payments/gateway.interface.ts`) with `initiate()` / `verify()` / `refund()`, resolved via `getPaymentGateway(name)` in `lib/payments/index.ts`. Your checkout endpoint doesn't branch on gateway logic — it just calls whichever adapter matches `payments.gateway`. Bank transfer and manual payments skip this factory entirely since there's no API to call; they go straight to a `payments` doc that an admin/partner later verifies (`payments.verifiedBy`).

**Refund caveat:** Nagad and AmarPay don't expose public merchant refund APIs — those are documented as manual processes through each provider's support/portal. bKash and SSLCommerz do support programmatic refunds. Build your refund UI to handle both cases (automatic call vs. "mark as refunded, process manually").

## Relationships

```
users (partner) 1---* properties 1---* room-types 1---* rooms
users (guest) 1---* bookings *---1 rooms
bookings 1---1 reviews
bookings 1---* payments
properties 1---* property-subscriptions *---1 subscription-plans
property-subscriptions 1---* payments
```

- **Partner → Properties**: one partner can list many properties (`properties.partner`).
- **Property → Room Types → Rooms**: a property has multiple room *types*; each type has multiple physical *rooms*. Bookings are made against a specific `room`, not just a room type, so overlap checks are simple date-range comparisons per room.
- **Booking → Payment**: one-to-many because a booking could have an initial payment plus a later refund record — each is its own `payments` doc with `purpose: booking_payment`.
- **Property → Subscription**: a property can have a history of subscriptions over time; only the current one with `status: active` matters for ranking.

## Availability logic

Rather than a separate inventory calendar, availability is derived by checking for overlapping bookings on a given `room`:

```
overlap exists if:
  existing.status in [pending_payment, confirmed, checked_in]
  AND existing.checkIn < newCheckOut
  AND existing.checkOut > newCheckIn
```

This runs in a `beforeValidate` hook on `bookings` (see `Bookings.ts`), so it's enforced at the database layer regardless of which frontend or API call creates the booking. For search results ("available rooms in Cox's Bazar, Aug 10–12"), your search endpoint should query `rooms` where no overlapping booking exists in that range, grouped up to `room-types` for display.

If you later want channel-manager-style stock control (e.g. "5 units of Deluxe Double" sold as inventory rather than named rooms), you'd replace `rooms` with a nightly `availability` collection keyed by `roomType + date + unitsAvailable`. Worth deferring until you actually need multi-channel sync.

## Commission logic

`platform-settings.defaultCommissionRate` is the global default (e.g. 10%). Any property can override it via `properties.commissionRateOverride`. When a booking is created, the `beforeChange` hook on `bookings` snapshots the effective rate into `booking.commissionRate` (so later changes to the global/property rate don't retroactively alter historical bookings) and computes:

```
subtotal          = roomType.basePrice × nights
commissionAmount  = subtotal × commissionRate / 100
partnerPayoutAmount = subtotal − commissionAmount
```

Use `partnerPayoutAmount` totals (filtered by property + date range) to drive your partner payout/reconciliation process.

## Loyalty points system

- **Earning**: when a `bookings` doc transitions into `status: checked_out` (not on creation, and not re-triggered on later saves), a `beforeChange` hook computes `pointsEarned = floor(totalAmount / 100 × earnRatePer100Spent)` and an `afterChange` hook posts an `earn` row to `loyalty-points` with an `expiresAt` date. Tying the earn event to `checked_out` rather than payment success avoids rewarding points on bookings that get cancelled or no-show after paying.
- **Redeeming**: the guest sets `bookings.pointsRedeemed` at checkout time. A `beforeValidate` hook checks it against `platform-settings.loyaltyProgram` rules (minimum redemption, can't exceed their balance, can't discount more than `maxRedeemPercentOfBooking`% of the booking subtotal) and converts it to `pointsDiscountAmount` using `redeemRate`. This reduces `totalAmount` but **not** `commissionAmount`/`partnerPayoutAmount` — the discount cost is absorbed by the platform, not the property partner. (If you'd rather split that cost with partners, that's a one-line change to the commission calc — flagging it as a business decision, not a technical constraint.)
- **Ledger vs. cache**: `loyalty-points` is an append-only ledger (never edit/delete a row — post an offsetting entry instead, e.g. `type: reverse` if a booking is cancelled after points were already earned). `users.pointsBalance` is a cached sum of that ledger, recomputed by a hook whenever a ledger entry posts, so you're not summing the whole ledger on every page load. If the cache ever drifts, it can be rebuilt from the ledger since that's the source of truth.
- **Expiry**: earned points carry an `expiresAt` (today + `pointsExpireAfterDays`). A daily scheduled job should find ledger `earn` rows past their expiry that haven't been offset yet, post a matching `expire` row, and recompute the balance.

## Coupons (separate from loyalty points)

Coupons and points solve different problems and are modeled independently rather than merged: coupons are **marketing-driven** (admin creates a time-boxed campaign, scoped to all properties / specific properties / a tier / a city, optionally auto-applied at checkout like OYO's `WELCOME80`), while points are **loyalty-driven** (earned automatically from past spend). A booking can have both applied at once.

**Stacking order matters** — `beforeChange` on `bookings` applies the coupon discount first against the raw `subtotal`, then applies the points discount against whatever's left. This prevents a guest from combining a large percentage coupon with a large points redemption and discounting past zero (both discounts are separately clamped so the combined total can't exceed `subtotal`).

Validation (`beforeValidate`) checks, in order: is the coupon active and within its date window, has it hit its total usage cap, does the property match the coupon's scope (specific properties / tier / city), has this guest already used it up to `usesPerUser`, is it restricted to first-time bookers, and does the booking meet `minBookingAmount`. All of this runs server-side against the coupon doc — never trust a discount amount passed from the client.

`coupons.currentUsageCount` increments in an `afterChange` hook on `bookings`, matching the same "increment on first successful save" pattern used for points.

## Localities

Rather than a free-text "area" field, `localities` is its own admin-managed collection — the same pattern OYO uses to structure city → locality → property (e.g. Goa → Calangute → a specific hotel). This buys you three things a text field can't: a "Popular localities" sidebar filter without scanning every property's address, dedicated locality landing pages (`isPopular` flags which ones get their own page), and a locality centroid (`location` point) to sort by distance before a guest has picked a specific property.

`properties.address.locality` is an optional relationship to this collection — optional because not every property needs a curated locality assigned, but any property that does gets pulled into that locality's filter and landing page automatically via the reverse `join` field.

## Trust badges & social proof

- **`trustBadges`** is a small admin-managed multi-select (Platform-Serviced, Listing Network, New Listing, Flagged) rendered as small badges on the search card — the same signal OYO sends with its "OYO-Serviced" badge vs. an aggregated "Listing Network" badge, plus a warning badge for properties with reported issues. `flaggedWarningNote` holds the guest-facing text for that last one. "New Listing" should be toggled by a scheduled job checking `createdAt` age, not left as a permanent manual flag someone forgets to clear.
- **`socialProof`** (`bookingsToday`, `bookingsLast6Hours`) is **deliberately not updated inside the booking hook**. Incrementing a counter on every booking write risks race conditions under concurrent bookings and doesn't handle the "today"/"last 6 hours" windows rolling forward — a booking made yesterday needs to age out of `bookingsToday` without anyone editing that document. Instead, run a scheduled job (every 15–30 min is plenty) that does a `count` query on `bookings` per property within each window and writes the result to `socialProof`. This is also cheaper at read time: the property list page reads a cached number instead of running a live aggregate per card.

## Featured placement (subscriptions)

1. Partner picks a plan from `subscription-plans` and pays via bKash/Nagad → creates a `property-subscriptions` doc (`status: pending_payment`) and a linked `payments` doc.
2. On payment success, an `afterChange` hook on `payments` flips the subscription to `status: active`, sets `startDate`/`endDate`, and copies `plan.benefits.priorityScore` + featured flags onto the `properties` doc (`isFeatured`, `featuredPriority`, `featuredUntil`).
3. A daily scheduled job (Payload job queue or an external cron hitting an endpoint) expires subscriptions past `endDate` and resets the property's featured fields.
4. Your homepage/top-search queries sort by `featuredPriority desc`, then by relevance/distance — so higher-tier plans rank above lower-tier ones, and non-subscribed properties fall back to normal relevance ranking (never fully hidden — keeps organic results honest).

## Location-based ("near me") search

The `properties.location` field uses Payload's `point` type (GeoJSON `[lng, lat]`), indexed as a geospatial index.

- **MongoDB adapter**: query with `where: { location: { near: [lng, lat, maxDistanceMeters] } }` — Payload translates this to `$near` natively, and results come back distance-sorted for free.
- **Postgres adapter**: `point` is stored but there's no built-in `$near`. Either enable PostGIS and write a raw query, or compute Haversine distance in a custom endpoint (`/api/search-nearby`) that pulls candidate properties within a bounding box first, then sorts in application code.

Combine distance with `isFeatured`/`featuredPriority` in your search endpoint, e.g.: fetch candidates within radius → sort by `(featuredPriority desc, distance asc)`.

## Filtering (location / price / availability)

Your public search endpoint (a custom Payload REST/GraphQL resolver, not raw collection `find`) should combine:
- `location.near` (or bounding box) for "near me"
- `room-types.basePrice` range for price filter
- The availability subquery above for date-range filter
- `properties.status: approved` always enforced
- `properties.amenities` for amenity filters

Keep this as a dedicated endpoint rather than exposing raw collection queries to the frontend — it lets you combine the geo, price, and availability logic server-side and keep the response shaped for the UI (property + cheapest matching room type + distance).

## Things intentionally left as `// TODO` in the code

- `payments` `afterChange` hook: wire up gateway webhook/verify calls (via `lib/payments/*.adapter.ts`), then update the related `bookings` or `property-subscriptions` doc. Also enforce that `bank_transfer`/`manual` payments can only reach `status: success` once `verifiedBy` is set.
- `bookings` `afterChange` hook: actually post the `loyalty-points` ledger rows and recompute `users.pointsBalance` — the shape is commented in the hook, just needs wiring to `req.payload.create()`.
- Access control for `bookings`/`property-subscriptions` read-by-partner: filtering "properties owned by this user" requires a lookup before returning the `where` clause — do this in a small helper (`getPartnerPropertyIds(user)`) called inside `access.read`.
- Refunds/cancellations: add a `refunds` collection or extend `payments` with `purpose: refund` if you need partial refund tracking beyond the `refunded` status.
- Payout tracking: once volumes grow, add a `payouts` collection that batches `partnerPayoutAmount` from multiple bookings into a single payout run per partner.
- Points expiry: a scheduled job to post `expire` ledger rows for `earn` entries past their `expiresAt` (see Loyalty points section above).
- `bookings` `afterChange` hook: increment `coupons.currentUsageCount` on first successful save with a `couponApplied` set (shape commented in the hook).
- Scheduled job for `properties.socialProof`: recompute `bookingsToday`/`bookingsLast6Hours` per property on a timer (see "Trust badges & social proof" section) rather than incrementing per-booking.
- Scheduled job for `trustBadges`: auto-add/remove the `new_listing` badge based on `createdAt` age.
- Environment variables needed per gateway: `BKASH_BASE_URL/APP_KEY/USERNAME/PASSWORD/APP_SECRET`, `NAGAD_BASE_URL/MERCHANT_ID/MERCHANT_NUMBER/CALLBACK_URL` + key file paths, `SSLCOMMERZ_STORE_ID/STORE_PASSWORD/MODE`, `AMARPAY_STORE_ID/SIGNATURE_KEY/MODE`. None of these belong in `platform-settings` (that's why only non-secret toggles like `enabled`/`mode` live there).

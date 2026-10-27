# Backend Architecture Plan — Hotel/Resort Booking Platform

This consolidates everything built so far (`payload-collections/`) into one start-to-finish plan: how the pieces fit together, what runs where, and what's still a `// TODO` you need to implement before launch. Where the data model itself is the subject, this doc points at `README.md` and the collection files rather than repeating field-by-field detail — this doc is about **architecture and process**, not schema.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| CMS/backend framework | Payload CMS 3.x | Collections + globals as the source of truth, generates a REST + GraphQL API and an admin UI for free |
| Database | MongoDB (recommended) or Postgres | Mongo gets you native geo queries (`point` field, `$near`) for free — see README's geo-search section. Postgres works but needs PostGIS or a manual Haversine query for the same feature. Pick Mongo unless you have a strong existing reason for Postgres. |
| Search index | Typesense (self-hosted) | Faceted/geo listing search — see §6 |
| Media storage | S3-compatible object storage (AWS S3, or Bangladesh-friendly alternatives/CDN in front of it) | Never store uploads on local disk in production — Payload's upload collections support cloud storage adapters directly |
| Background jobs | Payload's built-in Jobs Queue, or an external cron hitting authenticated endpoints | See §7 — several features depend on scheduled jobs, not request-time hooks |
| Caching / job broker | Redis | Backs the job queue if you outgrow Payload's default queue, and is useful for rate limiting, short-lived caches, and OTP storage (see §7a) |
| SMS | Alpha SMS (sms.bd) via a hand-written REST adapter | No official Node SDK exists — their API is a plain `api_key`-authenticated REST endpoint, thin enough that a custom adapter (`lib/sms/smsBd.adapter.ts`) is simpler and safer than depending on an unofficial third-party package. See §7a. |
| Transactional email | Resend, via the official `@payloadcms/email-resend` adapter | Plugs directly into Payload's `email` config — Payload's own auth emails (password reset, verification) route through it automatically, no custom code needed for those. Custom templates (booking confirmation, etc.) are React Email components rendered to HTML, sent via `payload.sendEmail()`. See §7b. |
| Hosting | Node.js container (Docker) behind a reverse proxy | Payload runs as a standard Node/Express (or Next.js custom server) app — containerize it like any other Node service |

---

## 2. Project structure

```
src/
  collections/
    Users.ts
    Properties.ts
    RoomTypes.ts
    Rooms.ts
    Amenities.ts
    Localities.ts
    Bookings.ts
    Payments.ts
    Reviews.ts
    Coupons.ts
    LoyaltyPoints.ts
    SubscriptionPlans.ts
    PropertySubscriptions.ts
    SmsLogs.ts
    EmailLogs.ts
    Media.ts               ← now built
  globals/
    PlatformSettings.ts
  endpoints/                ← custom REST endpoints beyond Payload's default CRUD (§8)
    search.ts
    coupons-apply.ts
    payments-initiate.ts
    payments-webhook.ts
    payments-verify.ts
    auth-send-otp.ts
    auth-verify-otp.ts
    email-webhook.ts
  jobs/                     ← scheduled task handlers (§7)
    expirePoints.ts
    expireSubscriptions.ts
    recomputeSocialProof.ts
    updateNewListingBadges.ts
    expireAbandonedBookings.ts
    syncSearchIndex.ts
    pollSmsDeliveryStatus.ts
    checkSmsBalance.ts
    generateAndSendInvoice.ts   ← queued on-demand from payments' afterChange, not scheduled
  lib/
    payments/                ← already built: gateway.interface.ts + per-gateway adapters
    sms/
      smsBd.adapter.ts        ← already built: sendSms / getSmsReport / getSmsBalance
    email/
      render.ts                ← already built: renders a template + calls payload.sendEmail()
      templates/
        BookingConfirmationEmail.tsx  ← already built, example
        PaymentReceiptEmail.tsx        ← already built
        BookingCancelledEmail.tsx
        PropertyApprovedEmail.tsx
        PropertyRejectedEmail.tsx
        PartnerNewBookingEmail.tsx
        PartnerPayoutSentEmail.tsx
        SubscriptionActivatedEmail.tsx
        AdminAlertEmail.tsx
    invoices/
      InvoiceDocument.tsx      ← already built: @react-pdf/renderer layout
      generateInvoicePdf.ts    ← already built: render → store → email
    search/
      typesenseClient.ts
      indexProperty.ts       ← builds the denormalized search document from a Properties doc
    access/
      getPartnerPropertyIds.ts   ← shared helper, see §4
  access/                     ← reusable access-control predicates, imported by collections
  payload.config.ts
```

Keep **business logic out of the collection files where it's reused** — a hook that needs the same "resolve this partner's property IDs" logic in three different collections' `access.read` should call one shared function (`lib/access/getPartnerPropertyIds.ts`), not repeat the query three times. This is called out as a `// TODO` in the collections already (`access.read` on `bookings` and `property-subscriptions` currently has a placeholder `{ property: { in: [] } }` — that's exactly where this helper plugs in).

---

## 3. Data model (summary — see README.md for full detail)

12 collections + 1 global, grouped by domain:

- **Identity**: `users` (guest/partner/admin roles)
- **Inventory**: `properties`, `room-types`, `rooms`, `amenities`, `localities`
- **Transactions**: `bookings`, `payments`
- **Trust**: `reviews`
- **Growth**: `coupons`, `loyalty-points`, `subscription-plans`, `property-subscriptions`
- **Notifications**: `sms-logs`, `email-logs`
- **Assets**: `media`
- **Config**: `platform-settings` (global)

The relationships, field-level detail, availability logic, commission calculation, and points/coupon stacking rules are all documented in `README.md` — that document is the schema reference. This document assumes that model and focuses on what runs it.

---

## 4. Access control philosophy

Three roles on `users`: `guest`, `partner`, `admin`. The pattern used throughout every collection:

```ts
access: {
  read: ({ req: { user } }) => {
    if (user?.role === 'admin') return true
    if (user?.role === 'partner') return { /* scoped to their own data */ }
    return { /* public/self-scoped fallback */ }
  },
}
```

**The recurring gap to close before launch**: several collections (`bookings`, `property-subscriptions`) have partner-read access stubbed as `{ property: { in: [] } }` with a comment to resolve the partner's owned property IDs first. Implement this once as a shared helper:

```ts
// lib/access/getPartnerPropertyIds.ts
export async function getPartnerPropertyIds(payload: Payload, partnerId: string): Promise<string[]> {
  const { docs } = await payload.find({
    collection: 'properties',
    where: { partner: { equals: partnerId } },
    limit: 0, // all matches
    select: { id: true }, // don't fetch full docs just for IDs
  })
  return docs.map((d) => d.id)
}
```

Then every partner-scoped `access.read` becomes `{ property: { in: await getPartnerPropertyIds(req.payload, user.id) } }`. This is a small function but it's load-bearing — get it wrong and either partners see each other's bookings, or see none of their own.

**Field-level access** is used sparingly and deliberately (e.g. `properties.status` is admin-write-only, `properties.commissionRateOverride` is admin-only, `reviews.ownerReply`→`partnerReply` is partner/admin-write) — prefer collection-level access for the common case and reach for field-level only when a single field within an otherwise-shared-access document needs a stricter rule.

---

## 5. Core business logic domains

Each of these is implemented as Payload hooks (`beforeValidate`, `beforeChange`, `afterChange`) on the relevant collection — already built, summarized here for the full picture:

**Property lifecycle**: `draft → pending → approved / rejected / suspended`, admin-only transition via `properties.status`. A property only becomes publicly visible (and searchable, see §6) once `approved`.

**Booking & availability**: bookings reference a specific `room` (not just a room type), and a `beforeValidate` hook rejects any booking whose date range overlaps an existing `pending_payment`/`confirmed`/`checked_in` booking on that same room. This is your source of truth for "is this room available" — the search index in §6 is a fast approximation on top of it, always re-verified here at the moment of booking.

**Pricing & commission**: computed server-side in `bookings`' `beforeChange` hook — `subtotal = basePrice × nights`, commission snapshotted from `properties.commissionRateOverride` or the platform default, coupon discount applied first against the raw subtotal, then points discount applied against the remainder, `totalAmount = subtotal - couponDiscount - pointsDiscount`. Commission is always calculated on the pre-discount subtotal — the platform absorbs both discount types, not the partner.

**Loyalty points**: append-only ledger (`loyalty-points`), points earned on the `checked_out` transition (not on payment, so cancelled bookings never earn), redeemed as an input at booking time with server-side validation against balance/min/max rules.

**Coupons**: a separate, marketing-driven discount mechanism, scoped to all-properties/specific-properties/tier/city, with usage caps and first-booking-only support, validated in the same `beforeValidate` hook as availability.

**Featured placement**: `subscription-plans` (admin-defined tiers) → `property-subscriptions` (a property's purchase of one) → on activation, copies `priorityScore` onto `properties.featuredPriority` for use in search ranking (§6).

**Trust badges & social proof**: `properties.trustBadges` is admin/scheduled-job managed; `properties.socialProof` is intentionally **not** updated inside the booking hook (race-condition and rolling-window concerns) — it's a scheduled job, see §7.

---

## 6. Search architecture

Full detail on the Typesense pipeline, geo-search, and the two-step discovery/confirmation model was covered separately — summarized here for completeness:

1. **Indexing**: `properties`' `afterChange` hook (and `room-types`' `afterChange`, since price changes affect the indexed `priceFrom`) calls `lib/search/indexProperty.ts`, which builds a denormalized document (`id, name, location, city, locality, tier, amenityIds[], starRating, avgRating, priceFrom, isFeatured, featuredPriority, trustBadges[]`) and upserts it into Typesense. Only fires for `status: approved` properties — a property leaving `approved` (suspended, rejected) should trigger a **delete** from the index, not just skip the upsert.
2. **Query time**: your `/api/search` custom endpoint (§8) takes the frontend's filter params, queries Typesense for geo/price/amenity/facet filtering and ranking (`featuredPriority desc`, then relevance/distance/price), gets back a generous candidate set (~200-300 IDs).
3. **Availability confirmation**: a follow-up Payload query filters that candidate set against real `bookings` overlap for the requested date range (same logic as the booking hook, reused — don't duplicate the overlap query, extract it to `lib/availability/checkOverlap.ts` and call it from both places).
4. Return the final ranked, paginated, availability-confirmed page to the frontend.

**This means the search index needs a resync job as a safety net** (§7) — if a webhook/hook fails silently, or you bulk-import properties outside Payload's normal write path, the index can drift from the database. A nightly full-resync job is cheap insurance.

---

## 7. Background jobs / scheduled tasks

These are the `// TODO`s flagged throughout the collections, consolidated into one list. Use Payload's Jobs Queue (recommended — it's built into Payload 3.x and avoids running a separate cron infrastructure) or an external scheduler hitting authenticated endpoints if you'd rather keep job execution outside the app process.

| Job | Frequency | What it does |
|---|---|---|
| `expirePoints` | Daily | Find `loyalty-points` `earn` rows past `expiresAt` without a matching offset, post `expire` rows, recompute affected `users.pointsBalance` |
| `expireSubscriptions` | Daily | Find `property-subscriptions` past `endDate` still `active`, flip to `expired`, reset the linked property's `isFeatured`/`featuredPriority` |
| `recomputeSocialProof` | Every 15–30 min | Count `bookings` per property within rolling windows (today, last 6 hours), write to `properties.socialProof` |
| `updateNewListingBadges` | Daily | Add/remove the `new_listing` trust badge based on `properties.createdAt` age |
| `expireAbandonedBookings` | Every 10–15 min | Find `bookings` stuck in `pending_payment` past a grace window (e.g. 30 min), cancel them, releasing the room hold — **this one matters more than it looks**, since without it your availability engine slowly fills up with dead holds |
| `syncSearchIndex` (full resync) | Nightly | Re-index all `approved` properties into Typesense as drift insurance (§6) |
| `incrementCouponUsage` / ledger posting for points | Event-driven, inside `bookings`' `afterChange` | Not a scheduled job — listed here only to distinguish it from the ones above; this runs synchronously on booking write, not on a timer |
| `pollSmsDeliveryStatus` | Every 5–10 min | Find `sms-logs` rows still `queued`/`pending`/`sent` with a `gatewayRequestId`, call `getSmsReport()`, update `deliveryStatus` |
| `checkSmsBalance` | Daily (or every few hours if SMS volume is high) | Calls `getSmsBalance()`; if below a threshold, alert an admin (email/dashboard notice) — sms.bd's `Error 417 Insufficient balance` fails sends silently otherwise, and OTP/booking-confirmation SMS quietly not going out is the kind of failure you want to catch before a guest notices, not after |

---

## 7a. SMS notifications (Alpha SMS / sms.bd)

**What it's for**: phone OTP verification at signup, booking confirmation/cancellation texts, payment success/failure texts, and partner-facing notifications (new booking received, payout sent). SMS matters more than email for a Bangladesh-market consumer product — treat it as a first-class notification channel, not an afterthought bolted onto email.

**Why a custom adapter instead of a package**: sms.bd's own documentation only shows a plain `axios` snippet as their "Node.js sample," not a maintained SDK — their real published packages are Laravel/PHP/C#/WHMCS/WordPress, no first-party Node option. Third-party npm packages exist but are unofficial and thinly maintained. Given the API surface is three simple REST calls (`sendsms`, `report/request/{id}`, `user/balance`) with a single `api_key` param — no OAuth, no request signing — a ~70-line hand-written adapter (`lib/sms/smsBd.adapter.ts`, already built) is both less risk and less code than vetting and depending on someone else's unofficial package.

**The one real integration wrinkle**: sms.bd's `sendsms` call only confirms *submission* (`request_id` returned), not delivery — there's no webhook. Actual delivery status only exists behind a pull-based `report/request/{id}/` endpoint. This is the same shape of problem as `properties.socialProof` (§5) — don't try to get delivery confirmation synchronously in the request that sent the SMS. Instead:

1. `sendSms()` is called from wherever the notification originates (e.g. `bookings`' `afterChange` hook on the `confirmed`/`cancelled` transitions, `payments`' `afterChange` on success/failure) and immediately writes an `sms-logs` row with `deliveryStatus: 'queued'` and the returned `gatewayRequestId`.
2. The `pollSmsDeliveryStatus` job periodically sweeps `sms-logs` rows still in a non-final state, calls `getSmsReport()`, and updates `deliveryStatus` to whatever sms.bd now reports.
3. Nothing in the booking/payment flow *waits* on delivery confirmation — a booking is confirmed based on payment success, not on whether the SMS about it was delivered. SMS failure should never block or roll back a business transaction; it's a notification, not a dependency.

**OTP verification flow** (`auth-send-otp` / `auth-verify-otp` endpoints): OTPs are short-lived and high-volume, so they don't belong in a Payload collection (that's Mongo/Postgres write load for data you want to throw away in minutes) — store them in **Redis** with a TTL (e.g. `otp:{phone}` → 6-digit code, 5-minute expiry, rate-limited to prevent resend spam). `auth-send-otp` generates the code, stores it in Redis, and calls `sendSms()` with `purpose: 'otp_verification'`. `auth-verify-otp` checks the submitted code against Redis, and on match either creates/verifies the `users` doc or lets a login proceed. This keeps OTP state out of your durable database entirely, which is exactly what you want for data that's meaningless after five minutes.

**Error handling**: map sms.bd's documented error codes into your logging rather than treating every failure identically — `410`/`411` (account/reseller expired) and `417` (insufficient balance) are account-level problems that `checkSmsBalance` should catch proactively, while `413`/`414`/`415`/`416` (bad sender ID, empty/too-long message, invalid number) are per-request problems worth surfacing back to whatever triggered the send (e.g. reject an OTP request for a malformed phone number before it ever reaches sms.bd).

---

## 7b. Transactional email (Resend)

**Two integration layers, not one** — this is the main thing that makes email's setup different from SMS:

1. **Payload's own auth emails** (password reset, email verification if `verify: true` is enabled on `users`) are handled entirely by Payload's built-in email system once you configure an adapter. There's an official first-party package for this — `@payloadcms/email-resend` — so nothing custom needs to be written for these two flows at all:

   ```ts
   // payload.config.ts
   import { resendAdapter } from '@payloadcms/email-resend'

   export default buildConfig({
     // ...
     email: resendAdapter({
       apiKey: process.env.RESEND_API_KEY!,
       defaultFromAddress: process.env.RESEND_FROM_ADDRESS!, // e.g. no-reply@mail.yoursite.com
       defaultFromName: process.env.RESEND_FROM_NAME!,
     }),
   })
   ```

   Once this is set, `payload.sendEmail({ to, subject, html, attachments? })` is available anywhere you have access to `payload` (hooks, endpoints, jobs) — this is what everything below actually calls.

2. **Custom transactional templates** (booking confirmation, partner notifications, etc.) — `payload.sendEmail()` takes `html`/`text`, not a React component, so templates are written as **React Email** components (`@react-email/components`) and rendered to an HTML string via `lib/email/render.ts`'s `sendTemplatedEmail()` helper before being handed to Payload. React Email was chosen specifically because the rest of this stack is already React/TypeScript — template authoring stays in the same language and mental model as the frontend, just with email-safe components instead of `packages/ui`'s shadcn components (email clients don't reliably render flexbox/grid/most CSS, which is why React Email renders to table-based HTML under the hood).

**Trigger points** — same pattern as SMS (called from the relevant collection's `afterChange` hook or a custom endpoint), mapped to which template fires:

| Trigger | Template | Notes |
|---|---|---|
| Payload's built-in `forgotPassword` flow | *(handled by Payload itself)* | No custom code — the adapter intercepts it |
| Payload's built-in email verification (if enabled) | *(handled by Payload itself)* | Same |
| `users` `afterChange`, on account creation | `WelcomeEmail` | |
| `bookings` `afterChange`, `→ confirmed` | `BookingConfirmationEmail` | Already built as the example template |
| `bookings` `afterChange`, `→ cancelled_by_guest`/`cancelled_by_partner` | `BookingCancelledEmail` | |
| `payments` `afterChange`, `→ success` | `PaymentReceiptEmail` | Now sent with the generated invoice PDF attached — see §9a for the full generation flow |
| `properties` `afterChange`, `status → approved`/`rejected` | `PropertyApprovedEmail` / `PropertyRejectedEmail` | To the partner |
| `bookings` `afterChange`, on creation | `PartnerNewBookingEmail` | To the property's partner |
| Payout batch job (§13 appendix TODO — payout tracking isn't built yet) | `PartnerPayoutSentEmail` | |
| `property-subscriptions` `afterChange`, `→ active` | `SubscriptionActivatedEmail` | To the partner |
| `checkSmsBalance` / any other ops threshold job | `AdminAlertEmail` | Generic — this replaces the vaguer "email/dashboard notice" mentioned in §7's job table; it's now a concrete template + send path |

**Webhooks (this is where email differs from SMS's polling model)**: Resend delivers events by webhook, not by a pull-based report endpoint — `POST /api/email/webhook` receives `delivered`/`bounced`/`complained`/`opened`/`clicked`/etc. events, verifies the request against `RESEND_WEBHOOK_SECRET` (Resend's SDK ships a `verify()` helper for this — never trust an unverified webhook body, same rule as the payment gateway webhooks in §8), and updates the matching `email-logs` row by `resendEmailId`. **No polling job is needed for email** — flagging this explicitly since it's the opposite of the SMS integration's `pollSmsDeliveryStatus` job, and it's easy to assume the two channels need symmetric infrastructure when they don't.

**Bounce/complaint handling**: Resend maintains its own automatic suppression list (it won't keep sending to an address that's hard-bounced or complained), so you don't need to build that logic yourself. What's still worth doing on your side: if a *booking confirmation* specifically bounces, that's an operationally important failure (a guest may not know their booking is confirmed) — worth having the webhook handler flag this back to `bookings` or trigger a fallback SMS via the `sendSms()` adapter from §7a, since you already have that channel available for exactly this kind of "the primary channel failed" case.

**Domain setup**: send from a dedicated subdomain (e.g. `mail.yoursite.com`), not the bare apex domain — this is standard email deliverability practice, keeping your main domain's sending reputation isolated from a subdomain that's easier to reconfigure if something goes wrong. Verify it in the Resend dashboard (SPF/DKIM/DMARC records) before any production sending; unverified domains are rate-limited/restricted.

---

## 8. API design — custom endpoints beyond default CRUD

Payload gives you REST + GraphQL CRUD on every collection automatically. These endpoints exist because they need to **orchestrate multiple collections or call external services**, which doesn't fit a single collection's CRUD:

| Endpoint | Purpose |
|---|---|
| `GET /api/search` | The listing page's main query — wraps Typesense + the availability confirmation step (§6) |
| `POST /api/coupons/apply` | Validates a coupon code against a draft booking's details before the guest commits, so errors surface at the "apply code" button, not after full checkout submission |
| `POST /api/payments/initiate` | Takes a booking/subscription + chosen gateway, calls the matching adapter's `initiate()` (`lib/payments/index.ts`), creates the `payments` doc, returns the redirect URL |
| `GET|POST /api/payments/webhook/:gateway` | Gateway-specific server-to-server callback (where the gateway supports it) — verifies the payload, updates the `payments` doc, cascades to `bookings`/`property-subscriptions` |
| `POST /api/payments/verify` | Called from the frontend's payment-status landing page after a browser redirect back — calls the adapter's `verify()`, since bKash/AmarPay confirmation happens on redirect-back rather than a pure webhook |
| `POST /api/payments/bank-transfer` | Guest submits transfer reference + receipt upload → creates a `payments` doc with `gateway: bank_transfer`, `status: pending`, awaiting partner/admin verification |
| `POST /api/auth/send-otp` | Generates a code, stores it in Redis with a TTL, sends it via `sendSms()` (§7a) — rate-limited per phone number |
| `POST /api/auth/verify-otp` | Checks the submitted code against Redis; on match, proceeds with signup/login |
| `POST /api/email/webhook` | Receives Resend's delivery/bounce/complaint/open/click events, verifies the signature, updates the matching `email-logs` row (§7b) |

**Webhook security**: every gateway webhook must verify the request actually came from the gateway (signature/checksum verification per provider's docs) before trusting its payload — treat an unverified webhook body as attacker-controlled input, since it directly triggers marking a booking as paid.

---

## 9. Media handling

The `Media` collection (now built — `collections/Media.ts`) handles both images (property/room photos, avatars, locality heroes) and PDFs (invoices, bank-transfer payment proofs) in one collection, backed by `@payloadcms/storage-s3`. Payload's image resizing (`imageSizes`) only triggers for image mime types, so PDFs pass through untouched — no need to split into separate collections for the two file types.

**How the frontend connects to it** — there are two distinct patterns, and which one to use depends on the field:

**Pattern A: proxied upload through Payload (simple, default).** The browser sends the file as `multipart/form-data` directly to Payload's own endpoint (`POST /api/media`), with the auth cookie included (`credentials: 'include'`, same cross-origin setup as §13's domain topology). Payload receives the file, hands it to the S3 adapter, creates the `media` document, and returns it — including the resulting `id` and the sized image URLs. Your frontend form then references that returned `id` in the parent document (e.g. `properties.images: [mediaId]`) on submit. This is the default with `@payloadcms/storage-s3` and needs no special configuration. Good for avatars, single-file uploads, anything where the file is small and upload volume is low.

```ts
// packages/api-client — a plain function, wrapped in a TanStack Query mutation in each app
export async function uploadMedia(file: File, purpose: string): Promise<{ id: string; url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('_payload', JSON.stringify({ purpose }))
  const res = await fetch(`${API_URL}/api/media`, { method: 'POST', body: formData, credentials: 'include' })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}
```

**Pattern B: direct-to-S3 client uploads (scales better, more moving parts).** Set `clientUploads: true` on the `s3Storage()` plugin config. The browser first asks Payload for a presigned URL, `PUT`s the file bytes straight to S3 (bypassing your Payload server entirely for the actual file transfer), then makes a small follow-up metadata-only request to Payload to register the document. This matters for `apps/partner`'s property/room-type photo galleries specifically — a partner uploading a dozen full-resolution photos in one form session is real bandwidth you don't want proxying through your API server twice (once in from the browser, once out to S3). Requires CORS configured on the S3 bucket to allow `PUT` from your frontend origins (same origin list as §13's CORS allowlist). **One known gotcha worth planning around**: `generateFileURL` (used when serving files from a custom domain/CDN in front of the bucket) has a documented interaction issue with `clientUploads` in some Payload versions — verify this combination works as expected against whatever Payload version you land on before relying on it for the partner upload flow.

**File-level access control caveat** — this is the part that's easy to get wrong: setting `access.read` on the `Media` collection (as done in `collections/Media.ts`, restricting `payment_proof`/`invoice` purposes to the uploader/admin) controls the *Payload document*, not necessarily the *raw file bytes*. If `generateFileURL` points directly at a public S3 URL, or the bucket itself is public, someone with a guessed/leaked URL can fetch the file regardless of what the collection's access control says — Payload's access control only actually gates the file when it's serving the file through its own route (i.e., you have NOT set `disablePayloadAccessControl: true`, or you're using `signedDownloads` for time-limited presigned GET URLs). For `payment_proof` and `invoice` files specifically, keep the bucket private and use `signedDownloads` (mentioned in the S3 adapter's config, §1) rather than a public bucket + public URL — property/room photos are the opposite case, where you *want* a plain public URL for CDN caching and fast page loads.

---

## 9a. PDF invoice generation

**Library**: `@react-pdf/renderer`, not Puppeteer/headless-Chrome-to-PDF. Same reasoning as choosing React Email for §7b's templates — it keeps invoice layout in the same JSX/component mental model as the rest of the stack, runs as a lightweight Node dependency rather than shipping a full browser binary, and `renderToBuffer()` gives you a `Buffer` directly usable for both storage and email attachment. This runs fine in Payload's standard Node server process — the handful of documented `@react-pdf/renderer` server-side issues are specific to edge/RSC runtimes (e.g. Next.js App Router edge functions), which doesn't apply here.

**The flow** (already built: `lib/invoices/InvoiceDocument.tsx` + `lib/invoices/generateInvoicePdf.ts`):

1. `payments`' `afterChange` hook, on the transition to `status: success` for a `booking_payment`, **enqueues a Payload Job** (`payload.jobs.queue({ task: 'generateAndSendInvoice', input: { bookingId } })`) rather than generating the PDF synchronously in the hook. This matters — PDF rendering + a storage write + an email send is real latency you don't want blocking whatever request triggered the payment webhook. Payload's Jobs Queue supports both scheduled tasks (§7's cron-style jobs) *and* this kind of on-demand queued task fired from a hook — it's the same queue infrastructure either way, not a separate system.
2. The job handler (`generateAndSendInvoice`) fetches the booking + related property/room-type/guest/settings, renders `InvoiceDocument` to a `Buffer` via `renderToBuffer()`.
3. That buffer is used **twice, without re-rendering**: once uploaded as a new `media` doc (`purpose: 'invoice'`) linked back onto `bookings.invoicePdf` — so the guest can re-download it later from `/dashboard/bookings/$bookingId` — and once attached directly to the `PaymentReceiptEmail` send via `sendTemplatedEmail()`'s `attachments` param.
4. **Invoice numbering** is currently just `INV-{bookingRef}` — simple and traceable, but not a guaranteed-sequential number. If your market requires strictly sequential invoice numbering for tax/VAT compliance (this varies by jurisdiction and is worth confirming with an accountant rather than assuming), that's a small but real change: a counter needs to live somewhere durable and race-condition-safe (a Payload global with an atomic increment, or a dedicated counter document), not just derived from the booking reference.

---

## 10. Environment & secrets

None of these belong in `platform-settings` (that global only holds non-secret toggles like `enabled`/`mode`) — they're runtime environment variables:

```
# Database
DATABASE_URI=

# Payload
PAYLOAD_SECRET=

# Media storage
S3_BUCKET= / S3_REGION= / S3_ACCESS_KEY= / S3_SECRET_KEY=

# Search
TYPESENSE_HOST= / TYPESENSE_API_KEY=

# bKash
BKASH_BASE_URL= / BKASH_APP_KEY= / BKASH_USERNAME= / BKASH_PASSWORD= / BKASH_APP_SECRET=

# Nagad
NAGAD_BASE_URL= / NAGAD_MERCHANT_ID= / NAGAD_MERCHANT_NUMBER= / NAGAD_CALLBACK_URL=
NAGAD_PRIVATE_KEY_PATH= / NAGAD_PUBLIC_KEY_PATH=

# SSLCommerz
SSLCOMMERZ_STORE_ID= / SSLCOMMERZ_STORE_PASSWORD= / SSLCOMMERZ_MODE=

# AmarPay
AMARPAY_STORE_ID= / AMARPAY_SIGNATURE_KEY= / AMARPAY_MODE=

# SMS (Alpha SMS / sms.bd)
SMS_BD_API_KEY= / SMS_BD_SENDER_ID=   # sender_id is optional, only if you have an approved sender ID

# Email (Resend)
RESEND_API_KEY= / RESEND_FROM_ADDRESS= / RESEND_FROM_NAME= / RESEND_WEBHOOK_SECRET=

# Redis (job queue, rate limiting, OTP storage)
REDIS_URL=
```

Never commit `.env` files; use your hosting platform's secrets manager in production, and keep Nagad's key *files* (not just paths) out of the repo entirely.

---

## 11. Security considerations

- **Never trust client-supplied pricing** — every discount, commission, and total is computed server-side in hooks, never accepted as-is from a request body. Already the pattern throughout `bookings`; keep it that way for any new money-related field.
- **Webhook signature verification** (§8) on every gateway callback, and equally on the Resend email webhook (§7b) — an unverified webhook body is attacker-controlled input regardless of which provider it claims to be from.
- **Rate limit** the public search and coupon-apply endpoints — both are unauthenticated and cheap to abuse (search scraping, coupon brute-forcing). **`auth-send-otp` needs this even more strictly** — it's a direct line to spending your SMS balance, so rate-limit per phone number *and* per IP (e.g. one OTP per phone per 60 seconds, a capped number per day) or it becomes both a cost-abuse vector and a way to spam a phone number that isn't even the attacker's.
- **PII handling**: `users.ownerProfile`→`partnerProfile` (KYC/NID, payout account numbers) and `payments.bankTransferDetails` hold sensitive financial identifiers — restrict read access tightly (admin + the record's own user only, never exposed in any public-facing query) and consider field-level encryption at rest if your hosting doesn't already encrypt the database volume.
- **Access control tests**: given how much of this system's correctness depends on `access` functions (partner isolation, guest-can't-see-other-guest's-bookings), these are worth explicit test coverage, not just manual spot-checks.

---

## 12. Testing strategy

- **Unit tests** for the pure calculation logic — pricing/commission math, coupon discount calculation, points redemption validation — extract these into plain functions (not buried inline in hooks) specifically so they're testable without spinning up Payload.
- **Integration tests** using Payload's testing utilities (in-memory or test-database Payload instance) for the hook-driven flows: booking overlap rejection, coupon validation rejecting an expired/over-limit code, points ledger posting correctly on `checked_out`.
- **Contract tests** for each payment adapter against the gateway's sandbox environment — these are the pieces most likely to break silently when a provider changes their API.

---

## 13. Deployment & domain topology

**Domain layout**: the public site runs on the apex/main domain, everything else on subdomains of the same registrable domain — this keeps auth simple (see below) while cleanly separating what's public/crawlable from what isn't.

| Domain | App | Crawlable? |
|---|---|---|
| `yoursite.com` (`www.` if you prefer) | `apps/web` (public site + guest dashboard) | Yes |
| `partner.yoursite.com` | `apps/partner` | No |
| `admin.yoursite.com` | `apps/admin` (custom dashboard) | No |
| `api.yoursite.com` | Payload backend — REST/GraphQL, custom endpoints, **and Payload's built-in admin panel at `api.yoursite.com/admin`** | No |
| `mail.yoursite.com` | Not an app — the dedicated sending domain verified in Resend (§7b), keeps email sending reputation isolated from the apex domain | N/A |

**Keeping Payload's built-in admin panel**: Payload auto-generates its own admin UI at `/admin` on wherever the backend is served, separate from the custom `apps/admin` dashboard built with TanStack/shadcn. Both are kept in this plan — the built-in panel is useful for quick manual data fixes, inspecting raw documents, and anything the custom dashboard hasn't gotten around to covering yet, while `apps/admin` is the polished day-to-day surface. Since it lives at `api.yoursite.com/admin`, it inherits the same auth cookie as everything else — an `admin`-role user is already logged into it if they've logged into `apps/admin`. No separate login flow to build or maintain.

**Cookie & CORS configuration** — this is the part that actually needs deliberate setup for the subdomain split to work:

- **Cookie domain**: set Payload's auth cookie to `Domain=.yoursite.com` (not the default host-only cookie) so it's readable across all four subdomains — this is what gives you SSO for free between `apps/partner`, `apps/admin`, and Payload's own `/admin` panel. A logged-in admin doesn't need to re-authenticate moving between `admin.yoursite.com` and `api.yoursite.com/admin`.
- **`SameSite=Lax` + `Secure`**: subdomains of the same registrable domain count as same-site to browsers, so `Lax` works fine here — no need for the looser `SameSite=None` (which would also require extra CSRF hardening you don't otherwise need).
- **CORS allowlist on the Payload backend**: since every frontend app is now cross-origin from `api.yoursite.com`'s perspective, Payload's `cors` config needs an explicit list of the three frontend origins (`yoursite.com`, `partner.yoursite.com`, `admin.yoursite.com`) with `credentials: true`. This must be an explicit allowlist, not a wildcard — browsers reject `Access-Control-Allow-Origin: *` on credentialed requests. Frontend fetch calls correspondingly need `credentials: 'include'` (already implied for `packages/api-client` — worth a comment in that package so nobody strips it out later).
- **Role checks still required**: the shared cookie proves *identity* across subdomains, not *authorization* for a given app — `apps/admin` and Payload's own `/admin` panel both still need to reject a non-admin session, same as any other role check in this system (§4).

**`noindex` on every non-public surface**: `partner.`, `admin.`, and `api.` (including Payload's `/admin` panel) should all ship `X-Robots-Tag: noindex` and never be linked from any crawlable page — only `yoursite.com` should be indexed. This lines up with the SSR-only-on-`apps/web` decision in the frontend plan.

**TLS**: a wildcard cert (`*.yoursite.com`) or per-subdomain certs — most hosts (Vercel, Cloudflare, etc.) auto-provision this per subdomain, rarely manual work.

**Payment gateway callbacks**: bKash/Nagad/SSLCommerz/AmarPay just need stable public HTTPS URLs for their success/fail/cancel/webhook callbacks — `api.yoursite.com/api/payments/...` (§8) works cleanly here since it's a fixed subdomain regardless of which frontend initiated the payment.

**Everything else from the original deployment plan still applies**:
- Containerize the Payload app (Docker), deploy behind a reverse proxy/load balancer with TLS termination.
- Run the Jobs Queue worker as either an in-process scheduled task or a separate worker process/container, depending on load — don't run heavy jobs (nightly full search resync) in the same process handling live request traffic if you can avoid it.
- Typesense and Redis run as their own services/containers, not embedded in the Payload app.
- Database backups: automated daily snapshots at minimum, given this holds financial transaction records.
- Separate sandbox/live credentials per payment gateway across your staging and production environments — never test against live gateway credentials.

---

## Appendix: full collection/global reference

| Name | Type | Domain |
|---|---|---|
| `users` | collection | Identity |
| `properties` | collection | Inventory |
| `room-types` | collection | Inventory |
| `rooms` | collection | Inventory |
| `amenities` | collection | Inventory |
| `localities` | collection | Inventory |
| `bookings` | collection | Transactions |
| `payments` | collection | Transactions |
| `reviews` | collection | Trust |
| `coupons` | collection | Growth |
| `loyalty-points` | collection | Growth |
| `subscription-plans` | collection | Growth |
| `property-subscriptions` | collection | Growth |
| `sms-logs` | collection | Notifications |
| `email-logs` | collection | Notifications |
| `media` | collection | Assets |
| `platform-settings` | global | Config |

Full field-level detail for every collection above lives in `README.md` and the individual files under `collections/`.

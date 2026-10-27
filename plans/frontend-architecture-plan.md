# Frontend Architecture Plan — Hotel/Resort Booking Platform

Scope: the public-facing storefront (`apps/web`) and the authenticated guest dashboard within it. The partner and admin dashboards (`apps/partner`, `apps/admin`) follow the same tooling and conventions described here (TanStack Router/Query/Table/Form, shadcn, Tailwind) but are separate SPAs — see the "Partner & admin apps" appendix for how they diverge.

---

## 1. Tech stack summary

| Concern | Choice | Why |
|---|---|---|
| Framework | TanStack Start | SSR for SEO-critical pages, file-based routing, server functions, same ecosystem as the rest of the stack |
| Routing | TanStack Router | Type-safe routes, typed + validated URL search params (this is what powers the filter UI) |
| Server state | TanStack Query | Caching, refetching, optimistic updates, pagination |
| Forms | TanStack Form + Zod | Multi-step checkout, profile forms, validation shared with backend schemas |
| Tables | TanStack Table | Booking history, admin/partner grids (not heavily used on the public site) |
| Styling | Tailwind CSS | Utility-first, pairs directly with shadcn |
| Components | shadcn/ui | Own the code, not a black-box dependency; easy to theme |
| Search index | Typesense (client calls go through your API, never direct from browser) | Faceted/geo search, as covered separately |
| Maps | MapLibre GL + react-map-gl (or Mapbox GL if you want their basemap/geocoding) | Search-as-you-move-map, property location pins |
| Auth | Payload's cookie-based JWT auth | Already built into your backend, no separate auth provider needed |

---

## 2. Monorepo & app structure

```
apps/
  web/                    ← this document's focus
    app/
      routes/
      components/
      features/
      lib/
      styles/
    app.config.ts
  partner/
  admin/
packages/
  ui/                     ← shared shadcn components + Tailwind preset
  api-client/             ← typed fetch wrappers + TanStack Query hooks
  types/                  ← `payload generate:types` output
  config/                 ← shared eslint/tsconfig/tailwind config
```

Inside `apps/web`, organize by **feature**, not by file type — a `search/` folder holds its own components, hooks, and route, rather than scattering related code across global `components/` and `hooks/` folders:

```
app/
  routes/                 ← TanStack Router file-based routes (thin — compose features)
  features/
    search/
    property-detail/
    booking-checkout/
    auth/
    dashboard/
      bookings/
      profile/
      loyalty/
      reviews/
    coupons/
  components/             ← truly generic, cross-feature UI (Header, Footer, PriceTag, StarRating)
  lib/
    api/                  ← re-exports from packages/api-client, feature-specific query hooks
    search-params/        ← Zod schemas for URL state (see §5)
  styles/
```

---

## 3. Public-facing pages

Route paths shown as file-based route segments. SSR column: **SSR** = server-rendered for SEO/first-paint, **CSR** = client-only is fine (behind auth or purely interactive).

| Page | Route | SSR? | Notes |
|---|---|---|---|
| Homepage | `/` | SSR | Search widget, popular cities, popular localities, featured properties strip |
| City listing | `/hotels-in-$city` | SSR | Main search results page — filters, map, facet counts, pagination |
| Locality listing | `/hotels-in-$locality-$city` | SSR | Same template as city listing, pre-filtered by locality |
| Tier/category listing | `/$tier-hotels-in-$city` (e.g. `/flagship-hotels-in-goa`) | SSR | Same template, pre-filtered by `tier` |
| Collection landing | `/hotels-in-$city/$collectionSlug` | SSR | Curated tag-based lists (family-friendly, business travellers, etc.) |
| Property detail | `/property/$propertySlug` | SSR | Gallery, room selector, amenities, reviews, sticky price widget |
| Search (map view) | same listing route, `?view=map` search param | CSR after initial SSR | Map/list toggle is client-side state layered on the SSR'd list |
| Coupons/offers | `/offers` | SSR | Public list of active, non-targeted coupons |
| Login | `/login` | CSR | Modal-first (opens over any page) with a dedicated route as fallback |
| Signup | `/signup` | CSR | Includes a phone OTP verification step (send code → 6-digit input → verify) backed by the backend's `auth-send-otp`/`auth-verify-otp` endpoints — see BACKEND_ARCHITECTURE.md §7a |
| Forgot/reset password | `/forgot-password`, `/reset-password` | CSR | Backed by Payload's built-in auth flow — the reset email itself is sent via Resend (BACKEND_ARCHITECTURE.md §7b), no custom email code needed on the backend for this one |
| Booking checkout — step 1: review & guest details | `/book/$roomTypeId` | CSR (behind login) | See §7 for the full checkout flow |
| Booking checkout — step 2: payment redirect | `/book/$roomTypeId/payment` | CSR | Redirects out to the gateway |
| Payment status / callback landing | `/booking/$bookingId/payment-status` | CSR | Gateway's `success_url`/`fail_url`/`cancel_url` all point here |
| Booking confirmation | `/booking/$bookingId/confirmed` | CSR | |
| Static content | `/about`, `/contact`, `/terms`, `/privacy`, `/cancellation-policy`, `/help` | SSR (mostly static) | Low priority, but easy SEO wins |
| 404 | catch-all | SSR | |

**Why SSR for the listing and detail pages specifically:** these are the pages Google needs to index and the pages people land on from search/ads — they need fast first paint and real content in the initial HTML, not a loading spinner. Everything behind login gets no SEO benefit, so CSR is the right tradeoff there (simpler data flow, no hydration mismatches to worry about).

---

## 4. Authenticated user dashboard

Nested under `/dashboard`, guarded by a route-level auth check that redirects to `/login?redirect=...` if unauthenticated.

| Page | Route | Purpose |
|---|---|---|
| Dashboard overview | `/dashboard` | Upcoming stay summary, points balance, quick links |
| Bookings — upcoming | `/dashboard/bookings` (tab/filter: upcoming) | List, cancel action, view details |
| Bookings — past/history | `/dashboard/bookings` (tab/filter: past) | Same list, filtered; "Leave a review" CTA on completed stays |
| Booking detail | `/dashboard/bookings/$bookingId` | Full itinerary, payment breakdown, cancellation policy, cancel/modify actions, invoice download |
| Profile & settings | `/dashboard/profile` | Name, phone, email, password change, avatar |
| Loyalty points | `/dashboard/points` | Balance, earn/redeem history (reads straight from the `loyalty-points` ledger), redemption rules explainer |
| My reviews | `/dashboard/reviews` | Reviews the guest has written, edit/delete |
| Saved coupons/offers | `/dashboard/offers` | Coupons the guest has used or can currently use — surfaces `firstBookingOnly`/scope-eligible ones |
| Notifications | `/dashboard/notifications` | Booking status changes, payment confirmations — simple list, mark-as-read |
| Logout | action, not a page | Clears session, redirects home |

Keep this section CSR-only inside `apps/web` (no SSR needed — it's behind auth, and TanStack Query's cache makes navigation between these tabs instant after the first load).

---

## 5. Routing & URL state (the core of the filtering UX)

**The listing page's filter state lives entirely in the URL**, validated with a Zod schema and typed through TanStack Router's search params:

```ts
// app/lib/search-params/listing.ts
import { z } from 'zod'

export const listingSearchSchema = z.object({
  checkIn: z.string().date().optional(),
  checkOut: z.string().date().optional(),
  adults: z.coerce.number().default(2),
  children: z.coerce.number().default(0),
  priceMin: z.coerce.number().optional(),
  priceMax: z.coerce.number().optional(),
  amenities: z.array(z.string()).default([]),
  tier: z.array(z.string()).default([]),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating', 'distance']).default('relevance'),
  view: z.enum(['list', 'map']).default('list'),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(), // map-bounds search
  page: z.coerce.number().default(1),
})
```

```ts
// app/routes/hotels-in.$city.tsx
export const Route = createFileRoute('/hotels-in/$city')({
  validateSearch: listingSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => queryClient.ensureQueryData(listingQueryOptions(params.city, deps)),
  component: ListingPage,
})
```

Every filter control (price slider, amenity checkbox, sort dropdown) calls `navigate({ search: (prev) => ({ ...prev, priceMax: value }) })` — nothing is local component state. This gives you, for free: shareable/bookmarkable filtered URLs, working browser back/forward through filter changes, and server-renderable initial results (the loader runs server-side on first load using the URL's search params).

**Query keys mirror the search params** so TanStack Query's cache naturally dedupes identical filter combinations:

```ts
const listingQueryOptions = (city: string, filters: ListingSearch) =>
  queryOptions({
    queryKey: ['listing', city, filters],
    queryFn: () => searchProperties(city, filters),
    placeholderData: keepPreviousData, // no flash-to-empty when filters change
  })
```

---

## 6. Data layer conventions

- `packages/api-client` exports plain async functions (`getProperty(slug)`, `searchProperties(city, filters)`, `createBooking(payload)`) that call your Payload REST/GraphQL API or your dedicated search endpoint — no React or TanStack Query inside this package, keep it framework-agnostic and reusable by the partner/admin apps too.
- `apps/web/lib/api/` wraps those functions in `queryOptions()`/`useMutation()` hooks, one file per feature (`useBookings.ts`, `useProperty.ts`, `useLoyaltyPoints.ts`).
- **Query key convention**: `[entity, id?, filters?]` — e.g. `['property', slug]`, `['bookings', userId, { status: 'upcoming' }]`, `['listing', city, searchParams]`. Consistent enough that invalidation is predictable (`invalidateQueries({ queryKey: ['bookings', userId] })` after a cancellation, for instance).
- **Mutations** (create booking, cancel booking, redeem points, submit review) invalidate the relevant query keys on success and, where it improves perceived speed, use optimistic updates (e.g. marking a booking "cancelling..." immediately while the request is in flight).

---

## 7. Booking checkout flow (state machine)

This is the most stateful part of the public site — worth planning explicitly rather than letting it grow organically.

```
1. Property detail page: guest picks room type + dates + guest count
   → navigates to /book/$roomTypeId with dates/guests as search params

2. /book/$roomTypeId (requires auth — redirect to /login?redirect=... if not logged in)
   → Shows: selected room summary, date range, price breakdown
   → Guest can: apply a coupon code, choose points to redeem (validated live against
     the same rules as the backend, so errors surface before submit, not after)
   → Guest picks payment method: bKash / Nagad / SSLCommerz / AmarPay / Bank Transfer / Manual
   → Submit creates a `bookings` doc (status: pending_payment) and, for gateway payments,
     a `payments` doc, then either:
       - redirects the browser to the gateway's checkout URL (bKash/Nagad/SSLCommerz/AmarPay), or
       - for bank_transfer: shows the platform's bank details + a receipt upload form inline,
         no external redirect
       - for manual: shows a "pending partner/admin confirmation" state, no redirect

3. Gateway redirect back → /booking/$bookingId/payment-status?...gateway params
   → This page calls your backend's verify endpoint (wraps the relevant adapter's verify())
   → Shows a loading state while verifying, then routes to:
       - success → /booking/$bookingId/confirmed
       - failure/cancel → back to /book/$roomTypeId with an error banner, booking rolled
         back to a re-attemptable state (don't leave it stuck in pending_payment forever —
         a background job should also expire abandoned pending_payment bookings after some
         window, releasing the room hold)

4. /booking/$bookingId/confirmed
   → Itinerary summary, "Add to calendar", link to /dashboard/bookings/$bookingId
```

Model this as an explicit state machine (even a simple discriminated union in a `useReducer`, not necessarily a full XState setup) rather than a pile of boolean flags — `status: 'selecting' | 'submitting' | 'redirecting' | 'verifying' | 'confirmed' | 'failed'` makes the UI trivial to reason about and prevents the classic "double submit while a redirect is pending" bug.

---

## 8. Component architecture

- **`packages/ui`** holds shadcn's generated components (`Button`, `Card`, `Dialog`, `Select`, etc.) plus your Tailwind theme config (colors, radii, fonts) as a shared preset all three apps extend. Customize shadcn's generated files here once, not per-app.
- **Composite, feature-specific components live in `features/*/components`**, not in the shared `ui` package — a `RoomTypeCard` or `BookingSummary` isn't reusable outside the booking feature, so don't force it into the shared layer prematurely.
- **Layout components** (`Header`, `Footer`, `DashboardSidebar`) live in `app/components/layout/` and are composed by route-level layout routes (TanStack Router's layout route pattern), not repeated in every page component.
- Follow shadcn's own convention: copy-paste ownership. Don't wrap shadcn components in another abstraction layer "just in case" — modify the copied component directly when you need to diverge.

---

## 9. Performance & SEO checklist for the public pages

- **Images**: serve from Payload's media collection through an image-resizing path (Payload has built-in image sizing config) — never ship full-resolution uploads to a listing page grid.
- **Meta tags**: TanStack Start's route `head()` export per route — dynamic title/description on property pages pulled from the property's `name`/`description`, canonical URLs on the paginated listing pages to avoid duplicate-content issues.
- **Sitemap**: generate at build/deploy time (or on a schedule) from your `properties`, `localities`, and static page routes — this is what actually gets your city/property pages crawled.
- **Core Web Vitals**: the listing page's biggest risk is layout shift from images loading in — reserve aspect-ratio boxes for every property card image before the network request resolves.
- **Debounce, don't block**: filter changes (price slider, map pan) should never block the UI waiting for a network round-trip — show the previous results dimmed (`isFetching` from TanStack Query) rather than a full-page spinner.

---

## 10. Auth flow specifics

**Domain topology**: `apps/web` runs on the main domain (`yoursite.com`), `apps/partner` and `apps/admin` on subdomains (`partner.yoursite.com`, `admin.yoursite.com`), and the Payload backend — including its own built-in admin panel — on `api.yoursite.com`. Full CORS/cookie/TLS configuration for this split lives in the backend doc's "Deployment & domain topology" section; the points below are what it means for the frontend specifically.

- Payload issues an httpOnly cookie on login, scoped to `Domain=.yoursite.com` so it's readable across all subdomains — a partner or admin who's already logged in doesn't get bounced to a login screen moving between apps. Your `packages/api-client` fetch calls must send `credentials: 'include'` on every request, since these are now cross-origin calls to `api.yoursite.com` from the browser's perspective.
- TanStack Start server functions in `apps/web` can read the current user server-side (for SSR'd pages that need to know "is this user logged in" without a client round-trip, e.g. showing "My Account" vs "Login" in the header on first paint).
- Protected routes (`/dashboard/*`, `/book/*`) use a `beforeLoad` check in TanStack Router that redirects unauthenticated users to `/login?redirect=<original path>`, so post-login they land back where they intended to go.
- **A shared cookie proves identity, not authorization for a given app** — `apps/partner` and `apps/admin` both still need their own `beforeLoad` role check (redirect out anyone whose `role` doesn't match), same as the backend's access-control functions independently enforce this server-side. Never rely on the frontend route guard alone.
- Login/signup as a **modal that can also be deep-linked to `/login`** — implement it as a route that renders inside a `<Dialog>` when navigated to from within the app (so the page behind stays visible/scrollable-state-preserved), but also works as a full page when hit directly (someone bookmarks or shares the login link).
- `apps/partner`, `apps/admin`, and Payload's own `/admin` panel should all ship `X-Robots-Tag: noindex` — only `apps/web` is meant to be crawlable.

---

## Appendix: Partner & admin apps

Same TanStack Router/Query/Table/Form + Tailwind + shadcn stack, same `packages/ui` and `packages/api-client`, deployed on their own subdomains (see §10), but:
- Plain Vite SPA, not TanStack Start — no SEO need behind a login wall, so skip SSR entirely and get simpler static-hosting deployment.
- Heavier use of **TanStack Table** (bookings grid, payments/payouts grid, property approval queue) with server-side pagination/sorting mapped to Payload's `where`/`sort`/`page` params.
- Heavier use of **TanStack Form** for the partner's property/room-type creation flow (multi-step, conditional fields, image uploads) — validated with the same Zod schemas that mirror your Payload field definitions where practical.
- No URL-driven filter state needed to the same degree as the public listing page — internal dashboards can lean more on component state or a lightweight store (Zustand) for things like "which table columns are visible," since there's no SEO/shareability reason to push that into the URL. Table *filters* (status, date range) are still worth putting in the URL though — makes support/debugging easier when someone shares a filtered-view link internally.
- **Payload's built-in admin panel** (`api.yoursite.com/admin`) is kept alongside `apps/admin`, not replaced by it — see the backend doc for why. Worth deciding per-feature whether something belongs in the polished custom dashboard or is fine left to the built-in panel (e.g. one-off manual data fixes rarely justify custom UI).

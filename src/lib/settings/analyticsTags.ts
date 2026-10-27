/**
 * Turning the analytics global into a list of scripts the storefront can render.
 *
 * This module holds the safety rules and stays free of Payload and React imports for two reasons: the
 * `analytics-settings` global imports the patterns from here, so anything `server-only` in the chain
 * would break the admin bundle, and the rules themselves are what has to be right — an ID typed by an
 * admin is interpolated straight into an inline `<script>`, which makes it executable code, so every
 * ID is matched against a strict pattern and anything unrecognised is dropped rather than escaped.
 * `getAnalyticsInjection` in `./analytics.ts` is the database-backed half.
 */

/** Measurement, Analytics and Ads IDs: `G-…`, `UA-…-…`, `AW-…`. */
export const GA_ID_PATTERN = /^(G-[A-Z0-9]{4,20}|UA-\d{4,12}-\d{1,4}|AW-\d{6,16})$/i
export const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/i
export const META_PIXEL_ID_PATTERN = /^\d{6,20}$/

export type ScriptStrategy = 'beforeInteractive' | 'afterInteractive' | 'lazyOnload'

const STRATEGIES: ScriptStrategy[] = ['beforeInteractive', 'afterInteractive', 'lazyOnload']

export interface AnalyticsScript {
  /** Stable React key, and the `id` next/script uses to de-duplicate inline snippets. */
  key: string
  strategy: ScriptStrategy
  /** Exactly one of these is set. */
  src?: string
  code?: string
}

export interface AnalyticsInjection {
  scripts: AnalyticsScript[]
  /** Tag Manager's no-JS fallback frame, rendered at the top of `<body>`. */
  noscriptFrames: { key: string; src: string }[]
}

export interface AnalyticsSettingsInput {
  enabled?: boolean | null
  googleTagManagerId?: string | null
  googleAnalyticsId?: string | null
  metaPixelId?: string | null
  externalScripts?:
    ({ src?: string | null; strategy?: string | null; id?: string | null } | null)[] | null
  inlineSnippets?:
    ({ label?: string | null; code?: string | null; strategy?: string | null } | null)[] | null
}

export const EMPTY_INJECTION: AnalyticsInjection = { scripts: [], noscriptFrames: [] }

/**
 * A `src` ends up as a live script tag, so only absolute `https:` URLs are accepted: `http:` would be
 * a mixed-content downgrade and any other scheme (`javascript:`, `data:`) is an execution vector.
 */
export function isSafeScriptSrc(value: string | null | undefined): boolean {
  const raw = value?.trim()
  if (!raw) return false
  try {
    return new URL(raw).protocol === 'https:'
  } catch {
    return false
  }
}

function normaliseStrategy(value: string | null | undefined): ScriptStrategy {
  return STRATEGIES.includes(value as ScriptStrategy)
    ? (value as ScriptStrategy)
    : 'afterInteractive'
}

function matchId(value: string | null | undefined, pattern: RegExp): string | null {
  const raw = value?.trim()
  return raw && pattern.test(raw) ? raw : null
}

export function buildAnalyticsInjection(
  settings: AnalyticsSettingsInput | null | undefined,
): AnalyticsInjection {
  // The master switch is checked first so an admin can stop every third-party request on the
  // storefront with one checkbox, without having to clear the fields.
  if (!settings || settings.enabled !== true) return EMPTY_INJECTION

  const scripts: AnalyticsScript[] = []
  const noscriptFrames: { key: string; src: string }[] = []

  const gtmId = matchId(settings.googleTagManagerId, GTM_ID_PATTERN)
  if (gtmId) {
    scripts.push({
      key: 'gtm',
      strategy: 'afterInteractive',
      code: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
    })
    noscriptFrames.push({
      key: 'gtm',
      src: `https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`,
    })
  }

  const gaId = matchId(settings.googleAnalyticsId, GA_ID_PATTERN)
  if (gaId) {
    scripts.push({
      key: 'ga-lib',
      strategy: 'afterInteractive',
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`,
    })
    scripts.push({
      key: 'ga-init',
      strategy: 'afterInteractive',
      code: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`,
    })
  }

  const pixelId = matchId(settings.metaPixelId, META_PIXEL_ID_PATTERN)
  if (pixelId) {
    scripts.push({
      key: 'meta-pixel',
      strategy: 'afterInteractive',
      code: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`,
    })
  }

  ;(settings.externalScripts ?? []).forEach((row, index) => {
    if (!row || !isSafeScriptSrc(row.src)) return
    scripts.push({
      key: `external-${index}`,
      strategy: normaliseStrategy(row.strategy),
      src: row.src!.trim(),
    })
  })
  ;(settings.inlineSnippets ?? []).forEach((row, index) => {
    const code = row?.code?.trim()
    if (!code) return
    scripts.push({
      key: `inline-${index}`,
      strategy: normaliseStrategy(row?.strategy),
      code,
    })
  })

  return { scripts, noscriptFrames }
}

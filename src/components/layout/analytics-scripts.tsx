import Script from 'next/script'

import type { AnalyticsInjection } from '@/lib/settings/analyticsTags'

/**
 * Renders the configured analytics tags.
 *
 * Kept dumb on purpose: it takes an already-built, already-validated `AnalyticsInjection` and does no
 * parsing of its own, so the only place a raw admin-supplied value is inspected is
 * `buildAnalyticsInjection`. `dangerouslySetInnerHTML` is how next/script takes inline code — the
 * safety here comes from the builder, not from this component.
 *
 * Mounted inside the `(frontend)` layout only, so nothing is injected into the admin panel.
 */
export function AnalyticsScripts({ injection }: { injection: AnalyticsInjection }) {
  if (injection.scripts.length === 0 && injection.noscriptFrames.length === 0) return null

  return (
    <>
      {injection.noscriptFrames.map((frame) => (
        <noscript key={frame.key}>
          <iframe
            src={frame.src}
            height="0"
            width="0"
            title="Tag Manager"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      ))}
      {injection.scripts.map((script) =>
        script.src ? (
          <Script key={script.key} id={script.key} src={script.src} strategy={script.strategy} />
        ) : (
          <Script
            key={script.key}
            id={script.key}
            strategy={script.strategy}
            dangerouslySetInnerHTML={{ __html: script.code ?? '' }}
          />
        ),
      )}
    </>
  )
}

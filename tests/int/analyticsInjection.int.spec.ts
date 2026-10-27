import { describe, expect, it } from 'vitest'

import {
  buildAnalyticsInjection,
  isSafeScriptSrc,
  type AnalyticsSettingsInput,
} from '@/lib/settings/analyticsTags'

// The IDs and snippets here are admin-supplied and end up inside an inline <script>, so the rejection
// cases are the ones that matter: an ID that does not match its pattern has to be dropped, never
// escaped and never interpolated.
const ON: AnalyticsSettingsInput = { enabled: true }

function keys(settings: AnalyticsSettingsInput) {
  return buildAnalyticsInjection(settings).scripts.map((script) => script.key)
}

describe('buildAnalyticsInjection — master switch', () => {
  it('injects nothing when disabled, even with tags configured', () => {
    const injection = buildAnalyticsInjection({
      enabled: false,
      googleTagManagerId: 'GTM-ABCD123',
      inlineSnippets: [{ code: 'console.log(1)' }],
    })
    expect(injection.scripts).toEqual([])
    expect(injection.noscriptFrames).toEqual([])
  })

  it('treats a missing switch as off', () => {
    expect(keys({ googleAnalyticsId: 'G-ABCDE12345' })).toEqual([])
  })

  it('injects nothing for null or empty settings', () => {
    expect(buildAnalyticsInjection(null).scripts).toEqual([])
    expect(buildAnalyticsInjection(undefined).scripts).toEqual([])
    expect(buildAnalyticsInjection(ON).scripts).toEqual([])
  })
})

describe('buildAnalyticsInjection — Tag Manager', () => {
  it('emits the loader and the no-JS frame', () => {
    const injection = buildAnalyticsInjection({ ...ON, googleTagManagerId: 'GTM-ABCD123' })
    expect(injection.scripts.map((s) => s.key)).toEqual(['gtm'])
    expect(injection.scripts[0].code).toContain("'GTM-ABCD123'")
    expect(injection.noscriptFrames).toEqual([
      { key: 'gtm', src: 'https://www.googletagmanager.com/ns.html?id=GTM-ABCD123' },
    ])
  })

  it('trims surrounding whitespace', () => {
    expect(keys({ ...ON, googleTagManagerId: '  GTM-ABCD123 ' })).toEqual(['gtm'])
  })

  it('drops a container ID that is not one', () => {
    for (const bad of [
      'ABCD123',
      'GTM-',
      'GTM-abc',
      "GTM-X');alert(1);//",
      '<script>alert(1)</script>',
      '',
      '   ',
    ]) {
      expect(keys({ ...ON, googleTagManagerId: bad })).toEqual([])
    }
  })
})

describe('buildAnalyticsInjection — Analytics and Ads', () => {
  it('emits the gtag library and the config call', () => {
    const injection = buildAnalyticsInjection({ ...ON, googleAnalyticsId: 'G-ABCDE12345' })
    expect(injection.scripts.map((s) => s.key)).toEqual(['ga-lib', 'ga-init'])
    expect(injection.scripts[0].src).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-ABCDE12345',
    )
    expect(injection.scripts[1].code).toContain("gtag('config','G-ABCDE12345')")
  })

  it('accepts the legacy UA and Ads formats', () => {
    expect(keys({ ...ON, googleAnalyticsId: 'UA-123456-1' })).toEqual(['ga-lib', 'ga-init'])
    expect(keys({ ...ON, googleAnalyticsId: 'AW-1234567890' })).toEqual(['ga-lib', 'ga-init'])
  })

  it('drops anything else', () => {
    for (const bad of ['GA-123', 'G-', "G-ABCDE12345');fetch('//evil.test", 'UA-1-1-1-1']) {
      expect(keys({ ...ON, googleAnalyticsId: bad })).toEqual([])
    }
  })

  it('adds no no-JS frame of its own', () => {
    expect(
      buildAnalyticsInjection({ ...ON, googleAnalyticsId: 'G-ABCDE12345' }).noscriptFrames,
    ).toEqual([])
  })
})

describe('buildAnalyticsInjection — Meta Pixel', () => {
  it('emits the pixel snippet with an init and a page view', () => {
    const injection = buildAnalyticsInjection({ ...ON, metaPixelId: '123456789012345' })
    expect(injection.scripts.map((s) => s.key)).toEqual(['meta-pixel'])
    expect(injection.scripts[0].code).toContain("fbq('init','123456789012345')")
    expect(injection.scripts[0].code).toContain("fbq('track','PageView')")
  })

  it('requires digits only', () => {
    expect(keys({ ...ON, metaPixelId: '12345' })).toEqual([])
    expect(keys({ ...ON, metaPixelId: '12345abcdef' })).toEqual([])
    expect(keys({ ...ON, metaPixelId: "123456');alert(1)" })).toEqual([])
  })
})

describe('buildAnalyticsInjection — hosted scripts', () => {
  it('keeps https URLs and their chosen strategy', () => {
    const injection = buildAnalyticsInjection({
      ...ON,
      externalScripts: [
        { src: 'https://cdn.example.com/a.js', strategy: 'lazyOnload' },
        { src: ' https://cdn.example.com/b.js ' },
      ],
    })
    expect(injection.scripts).toEqual([
      { key: 'external-0', strategy: 'lazyOnload', src: 'https://cdn.example.com/a.js' },
      { key: 'external-1', strategy: 'afterInteractive', src: 'https://cdn.example.com/b.js' },
    ])
  })

  it('falls back to afterInteractive for an unknown strategy', () => {
    const injection = buildAnalyticsInjection({
      ...ON,
      externalScripts: [{ src: 'https://cdn.example.com/a.js', strategy: 'whenever' }],
    })
    expect(injection.scripts[0].strategy).toBe('afterInteractive')
  })

  it('drops anything that is not an absolute https URL', () => {
    const injection = buildAnalyticsInjection({
      ...ON,
      externalScripts: [
        { src: 'http://cdn.example.com/a.js' },
        { src: 'javascript:alert(1)' },
        { src: 'data:text/javascript,alert(1)' },
        { src: '//cdn.example.com/a.js' },
        { src: '/local.js' },
        { src: '' },
        null,
      ],
    })
    expect(injection.scripts).toEqual([])
  })
})

describe('buildAnalyticsInjection — inline snippets', () => {
  it('passes the code through trimmed', () => {
    const injection = buildAnalyticsInjection({
      ...ON,
      inlineSnippets: [{ label: 'Heatmap', code: '  window.hj = 1  ', strategy: 'lazyOnload' }],
    })
    expect(injection.scripts).toEqual([
      { key: 'inline-0', strategy: 'lazyOnload', code: 'window.hj = 1' },
    ])
  })

  it('skips blank rows without shifting the keys of the rest', () => {
    const injection = buildAnalyticsInjection({
      ...ON,
      inlineSnippets: [{ code: '   ' }, { code: 'a()' }],
    })
    expect(injection.scripts).toEqual([
      { key: 'inline-1', strategy: 'afterInteractive', code: 'a()' },
    ])
  })
})

describe('buildAnalyticsInjection — ordering', () => {
  it('puts the tag manager first and custom code last', () => {
    expect(
      keys({
        ...ON,
        googleTagManagerId: 'GTM-ABCD123',
        googleAnalyticsId: 'G-ABCDE12345',
        metaPixelId: '123456789012345',
        externalScripts: [{ src: 'https://cdn.example.com/a.js' }],
        inlineSnippets: [{ code: 'a()' }],
      }),
    ).toEqual(['gtm', 'ga-lib', 'ga-init', 'meta-pixel', 'external-0', 'inline-0'])
  })

  it('gives every script a unique key', () => {
    const built = keys({
      ...ON,
      googleTagManagerId: 'GTM-ABCD123',
      externalScripts: [
        { src: 'https://cdn.example.com/a.js' },
        { src: 'https://cdn.example.com/b.js' },
      ],
      inlineSnippets: [{ code: 'a()' }, { code: 'b()' }],
    })
    expect(new Set(built).size).toBe(built.length)
  })
})

describe('isSafeScriptSrc', () => {
  it('accepts https only', () => {
    expect(isSafeScriptSrc('https://cdn.example.com/a.js')).toBe(true)
    expect(isSafeScriptSrc('http://cdn.example.com/a.js')).toBe(false)
    expect(isSafeScriptSrc('javascript:alert(1)')).toBe(false)
    expect(isSafeScriptSrc('cdn.example.com/a.js')).toBe(false)
    expect(isSafeScriptSrc(null)).toBe(false)
    expect(isSafeScriptSrc('   ')).toBe(false)
  })
})

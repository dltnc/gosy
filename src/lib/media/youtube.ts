/**
 * Turning whatever a partner pasted into a link we can safely embed.
 *
 * Everything here is pure and host-checked on purpose: the URL arrives from a partner-editable field,
 * so it is untrusted input that ends up as an iframe `src`. Only YouTube hosts and a strict 11-char
 * id charset get through, which means a `javascript:` or attacker-controlled URL can never reach the
 * frame — the id is extracted and a known-good embed URL is rebuilt around it.
 */

const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
])

/** Path prefixes that carry the id as the next segment: /embed/ID, /shorts/ID, /live/ID, /v/ID. */
const PATH_PREFIXES = ['embed', 'shorts', 'live', 'v', 'e']

/**
 * Accepts a watch link, a share link, an embed link, a Shorts or live URL, or a bare video id.
 * Returns the 11-character id, or `null` when the input is not a YouTube video we can embed.
 */
export function parseYouTubeId(input: string | null | undefined): string | null {
  const raw = input?.trim()
  if (!raw) return null

  // A bare id is convenient in the admin panel and is the one case with no URL to parse.
  if (ID_PATTERN.test(raw)) return raw

  let url: URL
  try {
    url = new URL(raw.includes('://') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (!HOSTS.has(url.hostname.toLowerCase())) return null

  const segments = url.pathname.split('/').filter(Boolean)

  // youtu.be/ID
  if (url.hostname.toLowerCase().endsWith('youtu.be')) {
    return segments[0] && ID_PATTERN.test(segments[0]) ? segments[0] : null
  }

  const watchId = url.searchParams.get('v')
  if (watchId && ID_PATTERN.test(watchId)) return watchId

  if (segments.length >= 2 && PATH_PREFIXES.includes(segments[0].toLowerCase())) {
    return ID_PATTERN.test(segments[1]) ? segments[1] : null
  }

  return null
}

/** True when `id` is exactly what `parseYouTubeId` produces — cheap guard before building a URL. */
export function isYouTubeId(id: string | null | undefined): boolean {
  return typeof id === 'string' && ID_PATTERN.test(id)
}

/**
 * The privacy-preserving embed host: it does not set tracking cookies until the guest actually
 * presses play, which matters because the gallery renders on every listing page view.
 */
export function youtubeEmbedSrc(id: string, options: { autoplay?: boolean } = {}): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' })
  if (options.autoplay) params.set('autoplay', '1')
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}

/** Poster frame for the facade tile. `hqdefault` exists for every video; `maxres` often does not. */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

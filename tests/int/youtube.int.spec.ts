import { describe, expect, it } from 'vitest'

import {
  isYouTubeId,
  parseYouTubeId,
  youtubeEmbedSrc,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from '@/lib/media/youtube'

// The URL here comes from a partner-editable field and its id ends up inside an iframe `src`, so the
// rejection cases matter more than the acceptance ones: anything that is not a YouTube host with an
// 11-character id has to come back null rather than being sanitised further downstream.
const ID = 'dQw4w9WgXcQ'

describe('parseYouTubeId', () => {
  it('accepts a watch URL', () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('accepts a watch URL with extra query parameters in any order', () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?list=PL123&v=${ID}&t=42s`)).toBe(ID)
  })

  it('accepts a youtu.be share link', () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}?t=30`)).toBe(ID)
  })

  it('accepts an embed URL', () => {
    expect(parseYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
  })

  it('accepts a Shorts URL', () => {
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
  })

  it('accepts a live URL', () => {
    expect(parseYouTubeId(`https://www.youtube.com/live/${ID}`)).toBe(ID)
  })

  it('accepts the mobile, music and nocookie hosts', () => {
    expect(parseYouTubeId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseYouTubeId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseYouTubeId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID)
  })

  it('accepts a link pasted without a scheme', () => {
    expect(parseYouTubeId(`youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(parseYouTubeId(`www.youtube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('accepts a bare id', () => {
    expect(parseYouTubeId(ID)).toBe(ID)
  })

  it('tolerates surrounding whitespace', () => {
    expect(parseYouTubeId(`  https://youtu.be/${ID}  `)).toBe(ID)
  })

  it('is case-insensitive about the host only', () => {
    expect(parseYouTubeId(`https://WWW.YouTube.com/watch?v=${ID}`)).toBe(ID)
  })

  it('rejects empty input', () => {
    expect(parseYouTubeId(null)).toBeNull()
    expect(parseYouTubeId(undefined)).toBeNull()
    expect(parseYouTubeId('')).toBeNull()
    expect(parseYouTubeId('   ')).toBeNull()
  })

  it('rejects other hosts, including lookalikes', () => {
    expect(parseYouTubeId(`https://vimeo.com/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeId(`https://youtube.com.evil.test/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull()
    // `youtu.be` is matched by suffix, so a host that merely ends with it must not slip through as a
    // path-style id.
    expect(parseYouTubeId(`https://evil-youtu.be.test/${ID}`)).toBeNull()
  })

  it('rejects non-http schemes', () => {
    expect(parseYouTubeId(`javascript:alert(1)//youtube.com/watch?v=${ID}`)).toBeNull()
    expect(parseYouTubeId(`data:text/html,<script></script>`)).toBeNull()
    expect(parseYouTubeId(`ftp://youtube.com/watch?v=${ID}`)).toBeNull()
  })

  it('rejects ids of the wrong length or charset', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}extra`)).toBeNull()
    expect(parseYouTubeId('https://www.youtube.com/watch?v=abcdefghij!')).toBeNull()
    expect(parseYouTubeId('abcdefghij')).toBeNull()
  })

  it('rejects YouTube URLs that do not point at a single video', () => {
    expect(parseYouTubeId('https://www.youtube.com/')).toBeNull()
    expect(parseYouTubeId('https://www.youtube.com/@somechannel')).toBeNull()
    expect(parseYouTubeId('https://www.youtube.com/playlist?list=PL1234567890')).toBeNull()
    expect(parseYouTubeId('https://www.youtube.com/results?search_query=hotel')).toBeNull()
  })

  it('rejects unparseable input', () => {
    expect(parseYouTubeId('http://')).toBeNull()
    expect(parseYouTubeId('not a url at all')).toBeNull()
  })
})

describe('isYouTubeId', () => {
  it('accepts an exact 11-character id and nothing else', () => {
    expect(isYouTubeId(ID)).toBe(true)
    expect(isYouTubeId('-_aAbB01234')).toBe(true)
    expect(isYouTubeId('too-short')).toBe(false)
    expect(isYouTubeId(`https://youtu.be/${ID}`)).toBe(false)
    expect(isYouTubeId(null)).toBe(false)
  })
})

describe('url builders', () => {
  it('builds a nocookie embed URL around the id', () => {
    const src = youtubeEmbedSrc(ID)
    expect(src.startsWith(`https://www.youtube-nocookie.com/embed/${ID}?`)).toBe(true)
    expect(src).not.toContain('autoplay=1')
  })

  it('adds autoplay only when asked', () => {
    expect(youtubeEmbedSrc(ID, { autoplay: true })).toContain('autoplay=1')
  })

  it('builds the poster frame on the thumbnail host', () => {
    expect(youtubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`)
  })

  it('builds a watch URL', () => {
    expect(youtubeWatchUrl(ID)).toContain(ID)
  })
})

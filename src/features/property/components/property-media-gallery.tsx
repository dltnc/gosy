'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Play } from 'lucide-react'

import { youtubeEmbedSrc, youtubeThumbnailUrl } from '@/lib/media/youtube'
import { Button } from '@/components/ui/button'

export interface GalleryPhoto {
  url: string
  caption?: string | null
}

export interface GalleryVideo {
  /** Already validated by `parseYouTubeId` on the server — this component never parses URLs. */
  id: string
  title?: string | null
}

type MediaItem =
  | { kind: 'photo'; key: string; photo: GalleryPhoto }
  | { kind: 'video'; key: string; video: GalleryVideo }

const MOSAIC_SIZE = 5

/**
 * Interleaves photos and videos so a video is never buried.
 *
 * The lead tile stays a photo — it is the large one and a poster frame reads worse there — but the
 * videos take the small slots immediately after it. Ordering them behind every photo would push them
 * out of the mosaic entirely on any listing with four or more images, which is most of them.
 */
export function orderMedia(photos: GalleryPhoto[], videos: GalleryVideo[]): MediaItem[] {
  const photoItems: MediaItem[] = photos.map((photo, index) => ({
    kind: 'photo',
    key: `photo-${index}`,
    photo,
  }))
  const videoItems: MediaItem[] = videos.map((video) => ({
    kind: 'video',
    key: `video-${video.id}`,
    video,
  }))

  if (photoItems.length === 0) return videoItems
  return [photoItems[0], ...videoItems, ...photoItems.slice(1)]
}

export function PropertyMediaGallery({
  photos,
  videos,
  propertyName,
}: {
  photos: GalleryPhoto[]
  videos: GalleryVideo[]
  propertyName: string
}) {
  const [playing, setPlaying] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const media = orderMedia(photos, videos)

  if (media.length === 0) {
    return (
      <section className="flex aspect-[16/9] items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground sm:aspect-[21/9]">
        No photos yet
      </section>
    )
  }

  const mosaic = media.slice(0, MOSAIC_SIZE)

  function tile(item: MediaItem, index: number, sizes: string, tileKey: string) {
    if (item.kind === 'photo') {
      return (
        <Image
          src={item.photo.url}
          alt={item.photo.caption || `${propertyName} photo ${index + 1}`}
          fill
          priority={index === 0}
          sizes={sizes}
          className="object-cover"
        />
      )
    }

    const { id, title } = item.video

    // A facade, not an eager iframe: the poster frame costs one image request, while five embedded
    // players would pull in the YouTube runtime on every listing page view. Tracked per *tile* rather
    // than per video, because the same video appears in both the mosaic and the expanded grid and two
    // autoplaying copies of it would talk over each other.
    if (playing !== tileKey) {
      return (
        <button
          type="button"
          onClick={() => setPlaying(tileKey)}
          aria-label={`Play video: ${title || propertyName}`}
          className="group absolute inset-0 h-full w-full cursor-pointer"
        >
          <Image
            src={youtubeThumbnailUrl(id)}
            alt=""
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-white/90 text-primary shadow-lift">
              <Play className="size-5 translate-x-px fill-current" aria-hidden />
            </span>
          </span>
          {title ? (
            <span className="absolute inset-x-0 bottom-0 line-clamp-1 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-left text-xs font-medium text-white">
              {title}
            </span>
          ) : null}
        </button>
      )
    }

    return (
      <iframe
        src={youtubeEmbedSrc(id, { autoplay: true })}
        title={title || `${propertyName} video`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    )
  }

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted sm:col-span-2 sm:row-span-2">
          {tile(mosaic[0], 0, '(max-width: 640px) 100vw, 50vw', `mosaic-${mosaic[0].key}`)}
        </div>
        {mosaic.slice(1).map((item, index) => (
          <div
            key={item.key}
            className="relative hidden aspect-[16/10] overflow-hidden rounded-xl bg-muted sm:block"
          >
            {tile(item, index + 1, '25vw', `mosaic-${item.key}`)}
          </div>
        ))}
      </div>

      {media.length > 1 ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            onClick={() => setExpanded((prev) => !prev)}
          >
            {expanded ? 'Hide gallery' : `Show all ${media.length} photos & videos`}
          </Button>

          {expanded ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {media.map((item, index) => (
                <div
                  key={`all-${item.key}`}
                  className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted"
                >
                  {tile(item, index, '(max-width: 768px) 50vw, 25vw', `all-${item.key}`)}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

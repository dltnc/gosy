'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ImagePlus, Loader2, Plus, Trash2, Video } from 'lucide-react'

import { parseYouTubeId } from '@/lib/media/youtube'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

export interface PropertyFormValues {
  id?: number
  name: string
  propertyType: string
  tier: string
  starRating: string
  description: string
  streetAddress: string
  area: string
  city: string
  postcode: string
  country: string
  contactPhone: string
  contactEmail: string
  checkInTime: string
  checkOutTime: string
  cancellationPolicy: string
  lat: string
  lng: string
}

export const EMPTY_PROPERTY_FORM: PropertyFormValues = {
  name: '',
  propertyType: 'hotel',
  tier: 'standard',
  starRating: '',
  description: '',
  streetAddress: '',
  area: '',
  city: '',
  postcode: '',
  country: 'Bangladesh',
  contactPhone: '',
  contactEmail: '',
  checkInTime: '14:00',
  checkOutTime: '12:00',
  cancellationPolicy: '',
  lat: '',
  lng: '',
}

export interface PropertyGalleryImage {
  mediaId: number
  url: string
  caption: string
}

export interface PropertyVideoValue {
  url: string
  title: string
}

interface VideoRow extends PropertyVideoValue {
  key: string
}

interface GalleryRow {
  key: string
  mediaId?: number
  url?: string
  preview?: string
  caption: string
  file?: File
}

interface PropertyFormProps {
  mode: 'create' | 'edit'
  initial?: PropertyFormValues
  heroImageUrl?: string | null
  initialGallery?: PropertyGalleryImage[]
  initialVideos?: PropertyVideoValue[]
}

function plainTextToLexical(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children: trimmed.split(/\n+/).map((line) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'text',
            mode: 'normal',
            style: '',
            detail: 0,
            format: 0,
            version: 1,
            text: line,
          },
        ],
        direction: 'ltr' as const,
      })),
      direction: 'ltr' as const,
    },
  }
}

async function uploadPropertyImage(file: File, alt: string): Promise<number> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('_payload', JSON.stringify({ purpose: ['property_photo'], alt }))
  const res = await fetch('/api/media', { method: 'POST', body: formData, credentials: 'include' })
  if (!res.ok) throw new Error('Image upload failed.')
  const media = (await res.json()) as { id: number }
  return media.id
}

function buildPayload(
  values: PropertyFormValues,
  heroImageId?: number,
  images?: { image: number; caption?: string }[],
  videos?: { url: string; title?: string }[],
) {
  return {
    name: values.name.trim(),
    propertyType: values.propertyType === 'resort' ? 'resort' : 'hotel',
    tier: values.tier,
    ...(values.starRating ? { starRating: Number(values.starRating) } : {}),
    ...(values.description ? { description: plainTextToLexical(values.description) } : {}),
    address: {
      streetAddress: values.streetAddress || undefined,
      area: values.area || undefined,
      city: values.city.trim(),
      postcode: values.postcode || undefined,
      country: values.country || undefined,
    },
    ...(values.contactPhone || values.contactEmail
      ? {
          contact: {
            phone: values.contactPhone || undefined,
            email: values.contactEmail || undefined,
          },
        }
      : {}),
    policies: {
      checkInTime: values.checkInTime || '14:00',
      checkOutTime: values.checkOutTime || '12:00',
      cancellationPolicy: values.cancellationPolicy || undefined,
    },
    ...(images ? { images } : {}),
    ...(videos ? { videos } : {}),
    ...((values.lat && values.lng) || heroImageId
      ? {
          ...(values.lat && values.lng
            ? { location: [Number(values.lng), Number(values.lat)] }
            : {}),
          ...(heroImageId ? { heroImage: heroImageId } : {}),
        }
      : {}),
  }
}

export function PropertyForm({
  mode,
  initial = EMPTY_PROPERTY_FORM,
  heroImageUrl,
  initialGallery = [],
  initialVideos = [],
}: PropertyFormProps) {
  const router = useRouter()
  const [values, setValues] = useState<PropertyFormValues>(initial)
  const [heroFile, setHeroFile] = useState<File | null>(null)
  const [gallery, setGallery] = useState<GalleryRow[]>(() =>
    initialGallery.map((image) => ({
      key: `media-${image.mediaId}`,
      mediaId: image.mediaId,
      url: image.url,
      caption: image.caption,
    })),
  )
  const [videos, setVideos] = useState<VideoRow[]>(() =>
    initialVideos.map((video, index) => ({ ...video, key: `video-${index}` })),
  )
  const [state, setState] = useState<'idle' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof PropertyFormValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  function addGalleryFiles(files: FileList | null) {
    if (!files?.length) return
    const rows: GalleryRow[] = Array.from(files).map((file, index) => ({
      key: `file-${Date.now()}-${index}`,
      caption: '',
      file,
      preview: URL.createObjectURL(file),
    }))
    setGallery((prev) => [...prev, ...rows])
  }

  function removeGalleryRow(key: string) {
    setGallery((prev) => prev.filter((row) => row.key !== key))
  }

  function addVideoRow() {
    setVideos((prev) => [...prev, { key: `video-new-${Date.now()}`, url: '', title: '' }])
  }

  function updateVideoRow(key: string, patch: Partial<PropertyVideoValue>) {
    setVideos((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function removeVideoRow(key: string) {
    setVideos((prev) => prev.filter((row) => row.key !== key))
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // Checked before anything is uploaded: the images are POSTed to /api/media one by one before the
    // property write, so a rejected video URL would otherwise leave orphaned uploads behind. The same
    // rule runs again server-side as a field `validate` — this is only for a faster, clearer message.
    const videoRows = videos.filter((row) => row.url.trim())
    const badVideo = videoRows.find((row) => !parseYouTubeId(row.url))
    if (badVideo) {
      setError(`"${badVideo.url.trim()}" is not a YouTube video link.`)
      return
    }

    setState('saving')

    try {
      let heroImageId: number | undefined
      if (heroFile) heroImageId = await uploadPropertyImage(heroFile, 'Property hero')

      const images: { image: number; caption?: string }[] = []
      for (const row of gallery) {
        let mediaId = row.mediaId
        if (row.file) mediaId = await uploadPropertyImage(row.file, row.caption || 'Property photo')
        if (mediaId)
          images.push({ image: mediaId, ...(row.caption ? { caption: row.caption } : {}) })
      }

      const videosPayload = videoRows.map((row) => ({
        url: row.url.trim(),
        ...(row.title.trim() ? { title: row.title.trim() } : {}),
      }))

      const res = await fetch(
        mode === 'create' ? '/api/properties' : `/api/properties/${initial.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...buildPayload(values, heroImageId, images, videosPayload),
            ...(mode === 'create' ? { status: 'pending', generateSlug: true } : {}),
          }),
        },
      )

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          errors?: { message?: string }[]
        } | null
        throw new Error(data?.errors?.[0]?.message ?? 'Could not save the property.')
      }

      const property = (await res.json()) as { id: number }
      router.push(`/partner/properties/${property.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the property.')
      setState('idle')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Property name *</Label>
            <Input
              id="name"
              required
              value={values.name}
              onChange={(e) => set('name')(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Property type</Label>
            <Select value={values.propertyType} onValueChange={(v) => set('propertyType')(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hotel">Hotel</SelectItem>
                <SelectItem value="resort">Resort</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tier</Label>
            <Select value={values.tier} onValueChange={(v) => set('tier')(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="budget">Budget</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="flagship">Flagship</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="starRating">Star rating (1–5)</Label>
            <Input
              id="starRating"
              type="number"
              min={1}
              max={5}
              value={values.starRating}
              onChange={(e) => set('starRating')(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={4}
              value={values.description}
              onChange={(e) => set('description')(e.target.value)}
              placeholder="What makes this property special?"
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="hero">Hero image</Label>
            {heroImageUrl && !heroFile ? (
              <p className="text-xs text-muted-foreground">
                Current:{' '}
                <a
                  href={heroImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  view uploaded image
                </a>{' '}
                — choose a file to replace.
              </p>
            ) : null}
            <Input
              id="hero"
              type="file"
              accept="image/*"
              onChange={(e) => setHeroFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Image gallery</Label>
            <p className="text-xs text-muted-foreground">
              Photos shown in the gallery grid on your listing page.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {gallery.map((row) => (
                <div key={row.key} className="space-y-2 rounded-lg border p-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-container">
                    {row.url || row.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.url ?? row.preview}
                        alt={row.caption || 'Gallery photo'}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <Input
                    value={row.caption}
                    onChange={(e) =>
                      setGallery((prev) =>
                        prev.map((item) =>
                          item.key === row.key ? { ...item, caption: e.target.value } : item,
                        ),
                      )
                    }
                    placeholder="Caption (optional)"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="w-full text-destructive"
                    onClick={() => removeGalleryRow(row.key)}
                  >
                    <Trash2 className="size-3" /> Remove
                  </Button>
                </div>
              ))}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <ImagePlus className="size-5" aria-hidden />
                Add photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    addGalleryFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Video tour</Label>
            <p className="text-xs text-muted-foreground">
              YouTube links shown next to your photos on the listing page. Watch, share, embed and
              Shorts URLs all work.
            </p>
            <div className="space-y-2">
              {videos.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.key}-url`} className="text-xs font-normal">
                      YouTube link *
                    </Label>
                    <Input
                      id={`${row.key}-url`}
                      value={row.url}
                      onChange={(e) => updateVideoRow(row.key, { url: e.target.value })}
                      placeholder="https://www.youtube.com/watch?v=…"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.key}-title`} className="text-xs font-normal">
                      Caption
                    </Label>
                    <Input
                      id={`${row.key}-title`}
                      value={row.title}
                      onChange={(e) => updateVideoRow(row.key, { title: e.target.value })}
                      placeholder="Optional"
                      className="h-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-destructive sm:mb-1.5"
                    onClick={() => removeVideoRow(row.key)}
                  >
                    <Trash2 className="size-3" /> Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addVideoRow}>
                {videos.length === 0 ? (
                  <>
                    <Video className="size-4" aria-hidden /> Add a video
                  </>
                ) : (
                  <>
                    <Plus className="size-4" aria-hidden /> Add another video
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Location & contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="street">Street address</Label>
            <Input
              id="street"
              value={values.streetAddress}
              onChange={(e) => set('streetAddress')(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area">Area</Label>
            <Input id="area" value={values.area} onChange={(e) => set('area')(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input
              id="city"
              required
              value={values.city}
              onChange={(e) => set('city')(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              value={values.postcode}
              onChange={(e) => set('postcode')(e.target.value)}
            />
          </div>
          <Separator className="sm:col-span-2" />
          <div className="space-y-1.5">
            <Label htmlFor="lat">Latitude</Label>
            <Input
              id="lat"
              inputMode="decimal"
              value={values.lat}
              onChange={(e) => set('lat')(e.target.value)}
              placeholder="21.4272"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lng">Longitude</Label>
            <Input
              id="lng"
              inputMode="decimal"
              value={values.lng}
              onChange={(e) => set('lng')(e.target.value)}
              placeholder="91.9708"
            />
          </div>
          <Separator className="sm:col-span-2" />
          <div className="space-y-1.5">
            <Label htmlFor="phone">Contact phone</Label>
            <Input
              id="phone"
              value={values.contactPhone}
              onChange={(e) => set('contactPhone')(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cemail">Contact email</Label>
            <Input
              id="cemail"
              type="email"
              value={values.contactEmail}
              onChange={(e) => set('contactEmail')(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Policies</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="checkin">Check-in time</Label>
            <Input
              id="checkin"
              value={values.checkInTime}
              onChange={(e) => set('checkInTime')(e.target.value)}
              placeholder="14:00"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="checkout">Check-out time</Label>
            <Input
              id="checkout"
              value={values.checkOutTime}
              onChange={(e) => set('checkOutTime')(e.target.value)}
              placeholder="12:00"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="policy">Cancellation policy</Label>
            <textarea
              id="policy"
              rows={3}
              value={values.cancellationPolicy}
              onChange={(e) => set('cancellationPolicy')(e.target.value)}
              placeholder="e.g. Free cancellation up to 48 hours before check-in."
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : mode === 'create' ? (
            'Submit for review'
          ) : (
            'Save changes'
          )}
        </Button>
        {mode === 'create' ? (
          <p className="text-xs text-muted-foreground">
            New listings are reviewed by the platform before going live.
          </p>
        ) : null}
      </div>
    </form>
  )
}

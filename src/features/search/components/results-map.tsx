'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'

import type { PropertySearchDocument } from '@/lib/search/searchProperties'

const OSM_STYLE: import('maplibre-gl').StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

export function ResultsMap({ results }: { results: PropertySearchDocument[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_STYLE,
      center: [90.4125, 23.8103],
      zoom: 5,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const marker of markersRef.current) marker.remove()
    markersRef.current = []

    const bounds = new maplibregl.LngLatBounds()
    let hasPoint = false

    for (const property of results) {
      if (!property.location) continue
      hasPoint = true

      const popup = new maplibregl.Popup({ offset: 24, closeButton: false }).setHTML(
        `<div style="font-family:system-ui;min-width:180px">
          <a href="/property/${property.slug}" style="font-weight:600;color:#1a73e8;text-decoration:none">${property.name}</a>
          <div style="margin-top:2px;font-size:12px;color:#555">৳${Math.round(property.priceFrom).toLocaleString()} / night · ★ ${property.avgRating.toFixed(1)}</div>
        </div>`,
      )

      const marker = new maplibregl.Marker({ color: '#1a73e8' })
        .setLngLat([property.location.lng, property.location.lat])
        .setPopup(popup)
        .addTo(map)

      marker.getElement().addEventListener('click', () => marker.togglePopup())
      markersRef.current.push(marker)
      bounds.extend([property.location.lng, property.location.lat])
    }

    if (hasPoint) {
      map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 400 })
    }
  }, [results])

  const geocoded = results.filter((r) => r.location).length

  return (
    <div className="space-y-3">
      <div className="relative h-[520px] overflow-hidden rounded-xl border">
        <div ref={containerRef} className="h-full w-full" />
        {geocoded < results.length ? (
          <p className="absolute bottom-2 left-2 rounded bg-background/90 px-2 py-1 text-xs text-muted-foreground">
            Showing {geocoded} of {results.length} stays — the rest have no map location set.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {results.slice(0, 6).map((property) => (
          <Link
            key={property.id}
            href={`/property/${property.slug}`}
            className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent"
          >
            <span className="truncate font-medium">{property.name}</span>
            <span className="shrink-0 pl-2 text-muted-foreground">
              ৳{Math.round(property.priceFrom).toLocaleString()}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

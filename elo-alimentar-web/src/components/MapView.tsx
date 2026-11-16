import { useEffect, useRef } from 'react'
import L from 'leaflet'

export interface MapMarker {
  lat: number
  lng: number
  text: string
  kind?: 'first' | 'ranked' | 'off' | 'batch'
  tooltip?: string
}

interface MapViewProps {
  markers: MapMarker[]
  center?: [number, number]
  zoom?: number
  height?: 'normal' | 'tall'
  onPick?: (lat: number, lng: number) => void
  label: string
}

const MANAUS: [number, number] = [-3.119, -60.0217]

function icon(marker: MapMarker) {
  const kind = marker.kind ?? 'ranked'
  const size = kind === 'first' ? 34 : 30

  return L.divIcon({
    className: '',
    html: `<div class="pin ${kind}">${marker.text}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function MapView({ markers, center = MANAUS, zoom = 12, height = 'normal', onPick, label }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onPickRef = useRef(onPick)

  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current).setView(center, zoom)

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; contribuidores do <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map)

    layerRef.current = L.layerGroup().addTo(map)
    map.on('click', (event: L.LeafletMouseEvent) => onPickRef.current?.(event.latlng.lat, event.latlng.lng))
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current

    if (!map || !layer) return

    layer.clearLayers()

    for (const marker of markers) {
      const item = L.marker([marker.lat, marker.lng], { icon: icon(marker), keyboard: false })

      if (marker.tooltip) item.bindTooltip(marker.tooltip, { direction: 'top', offset: [0, -14] })
      item.addTo(layer)
    }

    if (markers.length > 1 && !onPick) {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 })
    } else if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lng], map.getZoom())
    }
  }, [markers, onPick])

  return (
    <div
      ref={containerRef}
      className={`map-box ${height === 'tall' ? 'tall' : ''}`}
      role="application"
      aria-label={label}
    />
  )
}

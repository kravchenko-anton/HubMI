import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Issue } from '@/api/issues'
import { MAPLIBRE_WEB_VERSION, OPENFREEMAP_STYLE, USER_ZOOM } from '@/constants/map'
import { useIssueMarkers } from '@/hooks/use-issue-markers'
import { useSavedMapView } from '@/hooks/use-saved-map-view'
import { MARKER_SIZE, type IssueMapMarker } from '@/lib/cluster-issues'
import { useMapSheetStore } from '@/stores/map-sheet-store'
import { useMapViewportStore } from '@/stores/map-viewport-store'

const MAPLIBRE_BASE = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_WEB_VERSION}/dist`

type WebMap = {
  remove: () => void
  resize: () => void
  loaded: () => boolean
  flyTo: (options: { center: [number, number]; zoom: number; duration?: number }) => void
  getCenter: () => { lng: number; lat: number }
  getZoom: () => number
  getBounds: () => {
    getWest: () => number
    getSouth: () => number
    getEast: () => number
    getNorth: () => number
  }
  on: (event: 'load' | 'moveend', handler: () => void) => void
}

type WebMarker = {
  setLngLat: (lngLat: [number, number]) => WebMarker
  setOffset: (offset: [number, number]) => WebMarker
  addTo: (map: WebMap) => WebMarker
  remove: () => void
}

type MarkerFace = HTMLButtonElement & { __hubmi?: IssueMapMarker }

type MarkerHandle = {
  marker: WebMarker
  face: MarkerFace
  key: string
  pose: string
}

type MapLibreGL = {
  Map: new (options: {
    container: HTMLElement
    style: string
    center: [number, number]
    zoom: number
  }) => WebMap
  Marker: new (options?: { element?: HTMLElement; anchor?: string }) => WebMarker
}

declare global {
  interface Window {
    maplibregl?: MapLibreGL
  }
}

function ensureStylesheet() {
  const id = 'maplibre-gl-css'
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `${MAPLIBRE_BASE}/maplibre-gl.css`
  document.head.appendChild(link)
}

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl)

  ensureStylesheet()

  return new Promise<MapLibreGL>((resolve, reject) => {
    const script = document.createElement('script')
    script.type = 'module'
    script.textContent = `
      import * as maplibregl from '${MAPLIBRE_BASE}/maplibre-gl.mjs';
      window.maplibregl = maplibregl;
      window.dispatchEvent(new Event('hubmi-maplibre-ready'));
    `
    const onReady = () => {
      cleanup()
      if (window.maplibregl) resolve(window.maplibregl)
      else reject(new Error('MapLibre did not load'))
    }
    const onError = () => {
      cleanup()
      reject(new Error('MapLibre failed to load'))
    }
    const cleanup = () => {
      window.removeEventListener('hubmi-maplibre-ready', onReady)
      script.removeEventListener('error', onError)
    }
    window.addEventListener('hubmi-maplibre-ready', onReady)
    script.addEventListener('error', onError)
    document.head.appendChild(script)
  })
}

function userDot() {
  const dot = document.createElement('div')
  dot.style.width = '18px'
  dot.style.height = '18px'
  dot.style.borderRadius = '9px'
  dot.style.background = '#2F80ED'
  dot.style.border = '3px solid #FFFFFF'
  dot.style.boxShadow = '0 0 0 8px rgba(47, 128, 237, 0.28)'
  return dot
}

const MARKER_FADE = 'opacity 180ms ease'

function markerKey(marker: IssueMapMarker) {
  return marker.kind === 'point' ? `issue-${marker.id}` : `cluster-${marker.id}`
}

function paintFace(face: MarkerFace, marker: IssueMapMarker) {
  face.__hubmi = marker
  face.style.background = marker.color
  face.textContent = marker.emoji
  if (marker.kind === 'cluster' && marker.count > 1) {
    const badge = document.createElement('span')
    badge.textContent = String(marker.count)
    badge.style.position = 'absolute'
    badge.style.top = '-6px'
    badge.style.right = '-6px'
    badge.style.minWidth = '18px'
    badge.style.height = '18px'
    badge.style.padding = '0 4px'
    badge.style.borderRadius = '9px'
    badge.style.background = '#1C1C1E'
    badge.style.border = '2px solid #FFFFFF'
    badge.style.color = '#FFFFFF'
    badge.style.fontSize = '10px'
    badge.style.fontWeight = '700'
    badge.style.fontFamily = 'system-ui, sans-serif'
    badge.style.lineHeight = '14px'
    badge.style.boxSizing = 'border-box'
    face.appendChild(badge)
  }
}

function fadeIn(face: HTMLElement) {
  face.style.transition = 'none'
  face.style.opacity = '0'
  requestAnimationFrame(() => {
    face.style.transition = MARKER_FADE
    requestAnimationFrame(() => {
      face.style.opacity = '1'
    })
  })
}

function createMarkerElement(marker: IssueMapMarker, issuesRef: { current: Issue[] }) {
  const root = document.createElement('div')
  const face = document.createElement('button') as MarkerFace
  face.type = 'button'
  face.style.appearance = 'none'
  face.style.position = 'relative'
  face.style.width = `${MARKER_SIZE}px`
  face.style.height = `${MARKER_SIZE}px`
  face.style.borderRadius = `${MARKER_SIZE / 2}px`
  face.style.border = '3px solid #FFFFFF'
  face.style.boxSizing = 'border-box'
  face.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.28)'
  face.style.padding = '0'
  face.style.margin = '0'
  face.style.cursor = 'pointer'
  face.style.display = 'flex'
  face.style.alignItems = 'center'
  face.style.justifyContent = 'center'
  face.style.fontSize = '18px'
  face.style.lineHeight = '1'
  face.style.transition = MARKER_FADE
  paintFace(face, marker)
  face.addEventListener('click', () => {
    const current = face.__hubmi
    if (!current) return
    if (current.kind === 'point') {
      const issue = issuesRef.current.find((item) => item.id === current.id)
      if (issue) {
        useMapSheetStore.getState().openIssue(issue)
        return
      }
    }
    useMapViewportStore.getState().flyTo(
      [current.lng, current.lat],
      current.kind === 'cluster' ? current.expansionZoom : undefined,
    )
  })
  root.appendChild(face)
  return { root, face }
}

export function CityMap({ issues }: { issues: Issue[] }) {
  const containerRef = useRef<View>(null)
  const [error, setError] = useState<string | null>(null)
  const mapRef = useRef<WebMap | null>(null)
  const glRef = useRef<MapLibreGL | null>(null)
  const readyRef = useRef(false)
  const handlesRef = useRef<Map<string, MarkerHandle>>(new Map())
  const markers = useIssueMarkers(issues)
  const savedView = useSavedMapView()
  const markersRef = useRef(markers)
  const issuesRef = useRef(issues)
  const syncRef = useRef<() => void>(() => {})

  useEffect(() => {
    issuesRef.current = issues
  }, [issues])

  useEffect(() => {
    markersRef.current = markers
    syncRef.current = () => {
      const map = mapRef.current
      const gl = glRef.current
      if (!readyRef.current || !map || !gl) return
      const next = new Map(markersRef.current.map((marker) => [markerKey(marker), marker]))
      const handles = handlesRef.current

      for (const [key, marker] of next) {
        const pose = `${marker.lng.toFixed(5)},${marker.lat.toFixed(5)},${marker.offsetX},${marker.offsetY},${marker.emoji},${marker.kind === 'cluster' ? marker.count : 1}`
        const existing = handles.get(key)
        if (existing) {
          existing.marker.setLngLat([marker.lng, marker.lat])
          existing.marker.setOffset([marker.offsetX, marker.offsetY])
          if (existing.pose !== pose) {
            paintFace(existing.face, marker)
            existing.face.style.opacity = '1'
            existing.pose = pose
          } else {
            existing.face.__hubmi = marker
          }
          continue
        }
        const { root, face } = createMarkerElement(marker, issuesRef)
        const handle = new gl.Marker({ element: root, anchor: 'center' })
          .setLngLat([marker.lng, marker.lat])
          .setOffset([marker.offsetX, marker.offsetY])
          .addTo(map)
        handles.set(key, { marker: handle, face, key, pose })
        fadeIn(face)
      }

      for (const [key, handle] of handles) {
        if (next.has(key)) continue
        handle.face.style.opacity = '0'
        handles.delete(key)
        const removeTimer = window.setTimeout(() => handle.marker.remove(), 320)
        handle.face.addEventListener('transitionend', () => window.clearTimeout(removeTimer), { once: true })
      }
    }
    syncRef.current()
  }, [markers])

  useEffect(() => {
    if (!savedView) return
    const node = containerRef.current as unknown as HTMLElement | null
    if (!node) return

    let cancelled = false
    let loaded = false
    let map: WebMap | undefined
    let marker: WebMarker | undefined
    let lastFlyId = useMapViewportStore.getState().flyRequest?.id ?? 0

    const publishView = () => {
      if (!map) return
      const center = map.getCenter()
      const bounds = map.getBounds()
      useMapViewportStore.getState().setView({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bounds: {
          minLng: bounds.getWest(),
          minLat: bounds.getSouth(),
          maxLng: bounds.getEast(),
          maxLat: bounds.getNorth(),
        },
      })
    }

    const flyToRequest = () => {
      const request = useMapViewportStore.getState().flyRequest
      if (!map || !loaded || !request) return
      map.flyTo({ center: request.center, zoom: request.zoom, duration: 700 })
    }

    const unsubscribe = useMapViewportStore.subscribe((state) => {
      const id = state.flyRequest?.id
      if (!id || id === lastFlyId) return
      lastFlyId = id
      flyToRequest()
    })

    loadMapLibre()
      .then((maplibregl) => {
        if (cancelled) return
        glRef.current = maplibregl
        map = new maplibregl.Map({
          container: node,
          style: OPENFREEMAP_STYLE,
          center: savedView.center,
          zoom: savedView.zoom,
        })
        mapRef.current = map
        map.on('moveend', publishView)
        map.on('load', () => {
          loaded = true
          readyRef.current = true
          map?.resize()
          publishView()
          syncRef.current()
          flyToRequest()
          if (!navigator.geolocation) return
          navigator.geolocation.getCurrentPosition((position) => {
            if (cancelled || !map) return
            const center: [number, number] = [position.coords.longitude, position.coords.latitude]
            if (useMapViewportStore.getState().trackingPaused) {
              marker = new maplibregl.Marker({ element: userDot() }).setLngLat(center).addTo(map)
              return
            }
            map.flyTo({ center, zoom: USER_ZOOM })
            marker = new maplibregl.Marker({ element: userDot() }).setLngLat(center).addTo(map)
          })
        })
      })
      .catch(() => {
        if (!cancelled) setError('Map failed to load')
      })

    return () => {
      cancelled = true
      readyRef.current = false
      mapRef.current = null
      glRef.current = null
      handlesRef.current.clear()
      unsubscribe()
      marker?.remove()
      map?.remove()
    }
  }, [savedView])

  return (
    <View ref={containerRef} style={styles.map}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  error: {
    margin: 24,
    textAlign: 'center',
    color: '#57534E',
    fontSize: 16,
  },
})
